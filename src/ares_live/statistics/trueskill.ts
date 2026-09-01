import { Rating, TrueSkill } from 'ts-trueskill';

/**
 * TrueSkill match parameters as emitted by the game on the session's xuid=0 skill view. Values may
 * be missing (null) if the client did not provide them, in which case library defaults are used.
 */
export interface TrueSkillMatchParams {
    /** Probability of a draw. Accepts a fraction (0..1) or a percentage (>1); null uses the default. */
    drawProbability: number | null;
    /** Skill class width (uncertainty added per game). */
    beta: number | null;
    /** Additive dynamics factor (guards sigma from collapsing to zero). */
    tau: number | null;
}

/** A single player's TrueSkill input: their team, placement score and stored prior rating. */
export interface TrueSkillPlayerInput {
    xuid: string;
    team: number;
    /** Higher is better; used to rank teams. Ties produce draws. */
    relativeScore: number;
    /** Stored prior rating; null means the player has no rating yet (use defaults). */
    priorMu: number | null;
    priorSigma: number | null;
}

/** The recomputed rating for a player after the match. */
export interface TrueSkillPlayerResult {
    xuid: string;
    mu: number;
    sigma: number;
}

const DEFAULT_MU = 25;
const DEFAULT_SIGMA = DEFAULT_MU / 3;
const DEFAULT_BETA = DEFAULT_SIGMA / 2;
const DEFAULT_TAU = DEFAULT_SIGMA / 100;

/**
 * Runs a TrueSkill update for one match. Players are grouped into teams, teams are ranked by their
 * summed relativeScore (higher score = better placement, equal scores = a draw), and the ratings
 * are recomputed from each player's prior. Returns null when the match has fewer than two teams,
 * i.e. there is nothing to rate.
 */
export function computeTrueSkillRatings(
    params: TrueSkillMatchParams,
    players: TrueSkillPlayerInput[],
): TrueSkillPlayerResult[] | null {
    const teamOrder: number[] = [];
    const teams = new Map<number, TrueSkillPlayerInput[]>();
    for (const player of players) {
        let members = teams.get(player.team);
        if (!members) {
            members = [];
            teams.set(player.team, members);
            teamOrder.push(player.team);
        }
        members.push(player);
    }

    if (teams.size < 2) {
        return null;
    }

    const drawProbability = normalizeDrawProbability(params.drawProbability);
    const beta = params.beta !== null && Number.isFinite(params.beta) && params.beta > 0 ? params.beta : DEFAULT_BETA;
    const tau = params.tau !== null && Number.isFinite(params.tau) && params.tau >= 0 ? params.tau : DEFAULT_TAU;

    const env = new TrueSkill(DEFAULT_MU, DEFAULT_SIGMA, beta, tau, drawProbability);

    const ratingGroups: Rating[][] = [];
    const teamXuids: string[][] = [];
    const teamScores: number[] = [];
    for (const team of teamOrder) {
        const members = teams.get(team)!;
        ratingGroups.push(
            members.map((member) => {
                const mu = member.priorMu !== null && Number.isFinite(member.priorMu) ? member.priorMu : DEFAULT_MU;
                const sigma =
                    member.priorSigma !== null && Number.isFinite(member.priorSigma) && member.priorSigma > 0
                        ? member.priorSigma
                        : DEFAULT_SIGMA;
                return env.createRating(mu, sigma);
            }),
        );
        teamXuids.push(members.map((member) => member.xuid));
        teamScores.push(members.reduce((sum, member) => sum + (Number.isFinite(member.relativeScore) ? member.relativeScore : 0), 0));
    }

    // ts-trueskill ranks are 0-based where lower is better. Convert scores (higher is better) into
    // dense ranks, giving equal-scoring teams the same rank so they are treated as a draw.
    const ranks = scoresToRanks(teamScores);

    const rated = env.rate(ratingGroups, ranks);

    const results: TrueSkillPlayerResult[] = [];
    for (let t = 0; t < rated.length; t++) {
        for (let m = 0; m < rated[t].length; m++) {
            results.push({ xuid: teamXuids[t][m], mu: rated[t][m].mu, sigma: rated[t][m].sigma });
        }
    }
    return results;
}

/** Normalizes a raw draw probability into the (0,1) range TrueSkill expects. */
function normalizeDrawProbability(raw: number | null): number {
    if (raw === null || !Number.isFinite(raw) || raw < 0) {
        return 0.1; // ts-trueskill default
    }
    let value = raw;
    if (value > 1) {
        value = value / 100; // treat >1 as a percentage
    }
    if (value >= 1) {
        value = 0.99;
    }
    return value;
}

/** Maps team scores (higher is better) to 0-based dense ranks (lower is better), ties shared. */
function scoresToRanks(scores: number[]): number[] {
    const order = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score);
    const ranks = new Array<number>(scores.length).fill(0);
    let currentRank = 0;
    for (let k = 0; k < order.length; k++) {
        if (k > 0 && order[k].score < order[k - 1].score) {
            currentRank = k;
        }
        ranks[order[k].index] = currentRank;
    }
    return ranks;
}
