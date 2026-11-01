import * as H3 from '@blamnetwork/blf/halo3/v12070_08_09_05_2031_halo3_ship';
import { read_blf_file } from 'src/utils/blf_files';

/**
 * Multiplayer game results ("webstats") uploaded after a game:
 * `_blf athr mpgd mpmo mpvr mppl mptm mpma _par mpev glcp clif _eof`.
 */
export function read_webstats(buffer: Uint8Array) {
    return read_blf_file(buffer, {
        _blf: new H3.s_blf_chunk_start_of_file(),
        athr: new H3.s_blf_chunk_author(),
        mpgd: new H3.s_blf_chunk_multiplayer_game_description(),
        mpmo: new H3.s_blf_chunk_multiplayer_matchmaking_options(),
        mpvr: new H3.s_blf_chunk_game_variant(),
        mppl: new H3.s_blf_chunk_multiplayer_players(),
        mptm: new H3.s_blf_chunk_multiplayer_teams(),
        mpma: new H3.s_blf_chunk_multiplayer_machines(),
        _par: new H3.s_blf_chunk_multiplayer_statistics(),
        mpev: new H3.s_blf_chunk_multiplayer_events(),
        glcp: new H3.s_blf_chunk_game_local_players(),
        clif: new H3.s_blf_chunk_local_info(),
        _eof: new H3.s_blf_chunk_end_of_file(),
    });
}

export type multi = NonNullable<ReturnType<typeof read_webstats>>;

/** Campaign carnage report uploaded after a mission: `_blf athr gmop glcp cmrp cmrs clif _eof`. */
export function read_campaign_pgcr(buffer: Uint8Array) {
    return read_blf_file(buffer, {
        _blf: new H3.s_blf_chunk_start_of_file(),
        athr: new H3.s_blf_chunk_author(),
        gmop: new H3.s_blf_chunk_game_options(),
        glcp: new H3.s_blf_chunk_game_local_players(),
        cmrp: new H3.s_blf_chunk_campaign_metagame_results(),
        cmrs: new H3.s_blf_chunk_campaign_metagame_results_secondary(),
        clif: new H3.s_blf_chunk_local_info(),
        _eof: new H3.s_blf_chunk_end_of_file(),
    });
}

export type campaign = NonNullable<ReturnType<typeof read_campaign_pgcr>>;
