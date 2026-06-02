import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  build_hopper_statistics_file,
  hopper_population,
  s_blf_chunk_matchmaking_hopper_statistics,
  s_blf_chunk_network_lsp_heartbeat_data,
  s_online_population_statistic,
} from "@blamnetwork/blf/haloreach/v12065_11_08_24_1738_tu1actual";
import { PrismaService } from "src/db/prisma.service";
import ILogger, { ILoggerSymbol } from "src/ILogger";
import {
  extractReachPresencePlayers,
  ReachPresencePlayerSnapshot,
} from "./reach-presence-players";

/** Rows older than this are deleted from `reach.active_players`. */
const ACTIVE_PLAYER_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Default query window: players seen within the last minute. */
const ACTIVE_PLAYER_QUERY_RECENT_MS = 60 * 1000;

/** Rolling window for navbar 24h population (distinct presence heartbeats). */
export const ACTIVE_PLAYER_QUERY_24H_MS = 24 * 60 * 60 * 1000;

/** Hopper statistics BLF (per-hopper counts and total) uses a longer rolling window. */
const ACTIVE_PLAYER_QUERY_HOPPER_STATS_MS = 30 * 60 * 1000;

type ActivePlayerSessionFields = {
  session_id: Prisma.Decimal | null;
  gui_game_mode: number | null;
  session_game_mode: number | null;
  hopper_id: number | null;
  session_privacy: number | null;
  session_closed: number | null;
};

type ActivePlayerRow = ActivePlayerSessionFields & {
  player_xuid: Prisma.Decimal;
  team: number | null;
  updated_at: Date;
};

@Injectable()
export class HaloReachPopulationService {
  constructor(
    @Inject(ILoggerSymbol) private readonly logger: ILogger,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Host heartbeats replace the full session roster: drop roster XUIDs anywhere,
   * drop remaining rows for this session_id, then upsert the new roster.
   * Client heartbeats upsert local XUIDs (overwrites prior session fields).
   */
  public async recordPresenceHeartbeat(
    chunk: s_blf_chunk_network_lsp_heartbeat_data,
  ): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      if (chunk.has_players) {
        const sessionFields = this.sessionFieldsFromHeartbeat(chunk);
        const sessionId = sessionFields.session_id;
        if (!sessionId) {
          return;
        }

        const players = extractReachPresencePlayers(chunk);
        const playerXuids = this.playerXuidsAsDecimal(players);

        if (playerXuids.length > 0) {
          await tx.reach_active_player.deleteMany({
            where: { player_xuid: { in: playerXuids } },
          });
        }

        await tx.reach_active_player.deleteMany({
          where: { session_id: sessionId },
        });

        for (const player of players) {
          await this.upsertActivePlayer(
            tx,
            this.buildActivePlayerRow(player, sessionFields, now),
          );
        }
      } else {
        const players = extractReachPresencePlayers(chunk);
        const sessionFields = this.sessionFieldsFromHeartbeat(chunk);

        for (const player of players) {
          await this.upsertActivePlayer(
            tx,
            this.buildActivePlayerRow(player, sessionFields, now),
          );
        }
      }
    });
  }

  private recentCutoff(windowMs: number): Date {
    return new Date(Date.now() - windowMs);
  }

  private async purgeStalePlayers(): Promise<number> {
    const cutoff = this.recentCutoff(ACTIVE_PLAYER_RETENTION_MS);
    const result = await this.prisma.reach_active_player.deleteMany({
      where: { updated_at: { lt: cutoff } },
    });
    if (result.count > 0) {
      this.logger.log(
        `[ReachPopulation] purged ${result.count} stale active player row(s)`,
      );
    }
    return result.count;
  }

  public async getHopperPopulation(
    windowMs: number = ACTIVE_PLAYER_QUERY_RECENT_MS,
  ): Promise<{ hopper_id: number; player_count: number }[]> {
    await this.purgeStalePlayers();
    const cutoff = this.recentCutoff(windowMs);

    const rows = await this.prisma.$queryRaw<
      { hopper_id: number; player_count: bigint }[]
    >`
      SELECT hopper_id, COUNT(*)::bigint AS player_count
      FROM "reach"."active_players"
      WHERE hopper_id IS NOT NULL
        AND updated_at >= ${cutoff}
      GROUP BY hopper_id
      ORDER BY player_count DESC
    `;

    return rows.map((row) => ({
      hopper_id: row.hopper_id,
      player_count: Number(row.player_count),
    }));
  }

  public async getTotalActivePlayers(
    windowMs: number = ACTIVE_PLAYER_QUERY_RECENT_MS,
  ): Promise<number> {
    await this.purgeStalePlayers();
    return this.prisma.reach_active_player.count({
      where: { updated_at: { gte: this.recentCutoff(windowMs) } },
    });
  }

  public async getActiveLobbies(
    windowMs: number = ACTIVE_PLAYER_QUERY_RECENT_MS,
  ): Promise<
    {
      sessionId: string | null;
      guiGameMode: number | null;
      sessionGameMode: number | null;
      hopperId: number | null;
      sessionPrivacy: number | null;
      sessionClosed: number | null;
      players: { playerXuid: string; team: number | null }[];
    }[]
  > {
    await this.purgeStalePlayers();

    const rows = await this.prisma.reach_active_player.findMany({
      where: { updated_at: { gte: this.recentCutoff(windowMs) } },
      orderBy: [{ session_id: "asc" }, { team: "asc" }],
    });

    const lobbyMap = new Map<
      string,
      {
        sessionId: string | null;
        guiGameMode: number | null;
        sessionGameMode: number | null;
        hopperId: number | null;
        sessionPrivacy: number | null;
        sessionClosed: number | null;
        players: { playerXuid: string; team: number | null }[];
      }
    >();

    for (const row of rows) {
      const sessionKey = row.session_id?.toString() ?? "__none__";
      let lobby = lobbyMap.get(sessionKey);
      if (!lobby) {
        lobby = {
          sessionId: row.session_id?.toString() ?? null,
          guiGameMode: row.gui_game_mode,
          sessionGameMode: row.session_game_mode,
          hopperId: row.hopper_id,
          sessionPrivacy: row.session_privacy,
          sessionClosed: row.session_closed,
          players: [],
        };
        lobbyMap.set(sessionKey, lobby);
      }

      lobby.players.push({
        playerXuid: row.player_xuid.toString(),
        team: row.team,
      });
    }

    return Array.from(lobbyMap.values()).sort(
      (a, b) => b.players.length - a.players.length,
    );
  }

  public async getHopperStatistics(): Promise<Uint8Array> {
    const [hopperRows, totalPlayers] = await Promise.all([
      this.getHopperPopulation(ACTIVE_PLAYER_QUERY_HOPPER_STATS_MS),
      this.getTotalActivePlayers(ACTIVE_PLAYER_QUERY_HOPPER_STATS_MS),
    ]);

    const mmhs = new s_blf_chunk_matchmaking_hopper_statistics();
    mmhs.total_population = totalPlayers;
    mmhs.unknown_population_2 = 0;
    mmhs.unknown_population_3 = 0;
    mmhs.hoppers = hopperRows.map((row) => {
      const hopper = new s_online_population_statistic();
      hopper.presence_type = 2; // not sure what this magic number is, doesnt work without it 
      hopper.hopper_identifier = row.hopper_id;
      hopper.player_count = row.player_count;
      return hopper;
    });

    return build_hopper_statistics_file(mmhs);
  }

  private sessionFieldsFromHeartbeat(
    chunk: s_blf_chunk_network_lsp_heartbeat_data,
  ): ActivePlayerSessionFields {
    if (!chunk.has_players) {
      return {
        session_id: null,
        gui_game_mode: null,
        session_game_mode: null,
        hopper_id: null,
        session_privacy: null,
        session_closed: null,
      };
    }

    const session = chunk.session_data;
    return {
      // Host heartbeats use machine_id as the LSP session id (matches phbr session_id).
      session_id: new Prisma.Decimal(chunk.machine_id.toString()),
      gui_game_mode: session.gui_game_mode,
      session_game_mode: session.session_game_mode,
      hopper_id: session.hopper_id === 0 ? null : session.hopper_id,
      session_privacy: session.session_piracy_mode.network_session_privacy,
      session_closed: session.session_piracy_mode.network_session_closed_status,
    };
  }

  private playerXuidsAsDecimal(
    players: ReachPresencePlayerSnapshot[],
  ): Prisma.Decimal[] {
    return players.map(
      (player) => new Prisma.Decimal(player.playerXuid.toString()),
    );
  }

  private async upsertActivePlayer(
    tx: Prisma.TransactionClient,
    data: ActivePlayerRow,
  ): Promise<void> {
    const { player_xuid, ...updateFields } = data;
    await tx.reach_active_player.upsert({
      where: { player_xuid },
      create: data,
      update: updateFields,
    });
  }

  private buildActivePlayerRow(
    player: ReachPresencePlayerSnapshot,
    sessionFields: ActivePlayerSessionFields,
    updatedAt: Date,
  ): ActivePlayerRow {
    return {
      player_xuid: new Prisma.Decimal(player.playerXuid.toString()),
      ...sessionFields,
      team: player.team ?? null,
      updated_at: updatedAt,
    };
  }
}
