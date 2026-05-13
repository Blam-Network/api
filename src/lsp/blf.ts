import { blf } from "src/blf";
import { c } from "src/cstruct";
import { PAD1 } from "src/cstruct/macros";
import { time64_t } from "src/cstruct/time";

export namespace HaloReach {
    export namespace v12065 {
        export enum FileType {
          Screenshot = 2,
          Film = 3,
          FilmClip = 4,
          MapVariant = 5,
          GameVariant = 6,
        }
        export enum GameEngine {
          Multiplayer = 2,
          Campaign = 3,
          Firefight = 4,
        }
        export enum FileAgeFilter {
          Day = 0,
          Week = 1,
          Month = 2,
        }
        export enum FileSortBy {
          DateAdded = 0,
          HighestRanked = 1,
          MostViewed = 2,
          MostRelated = 3, // ???
        }

        export const s_online_file_summary_listing_entry = c.createCStruct({pack: 1, endian: 'big', fields: [
          {name: 'share_id', type: 'u64'},
          {name: 'screenshots_count', type: 'u32'},
          {name: 'films_count', type: 'u32'},
          {name: 'game_variants_count', type: 'u32'},
          {name: 'map_variants_count', type: 'u32'},
          {name: 'new_items_count', type: 'u32'},
          {name: 'unknown1C', type: 'u32'},
          {name: 'unknown20', type: 'u32'},
        ]});

        export const s_content_item_history = c.createCStruct({pack: 1, endian: 'big', fields: [
          { name: 'timestamp', type: new time64_t() },
          { name: 'xuid', type: 'u64' },
          { name: 'name', type: new c.String(16, 'latin1') },
          { name: 'is_online', type: 'u8' },
          PAD1, PAD1, PAD1,
        ]})
        
        export const s_content_item_game_variant_metadata = c.createCStruct({pack: 1, endian: 'big', fields: [
          { name: 'icon_index', type: 'i8' },
        ]});
        
        export const s_content_item_film_metadata = c.createCStruct({pack: 1, endian: 'big', fields: [
          { name: 'seconds', type: 'i32' },
        ]});
        // i think theres one for forge too but idk where
        
        export const s_content_item_matchmaking_metadata = c.createCStruct({pack: 1, endian: 'big', fields: [
          { name: 'hopper_identifier', type: 'u16' },
        ]});
        
        export const s_content_item_metadata_campaign_data = c.createCStruct({pack: 1, endian: 'big', fields: [
          { name: 'campaign_id', type: 'i32' },
          { name: 'campaign_difficulty', type: 'i16' },
          { name: 'campaign_metagame_scoring', type: 'i16' },
          { name: 'campaign_insertion_point', type: 'i32' },
          { name: 'campaign_primary_skulls', type: 'i16' },
          { name: 'campaign_secondary_skulls', type: 'i16' },
        ]});
        
        export const s_content_item_metadata_firefight_data = c.createCStruct({pack: 1, endian: 'big', fields: [
          { name: 'firefight_difficulty', type: 'i16' },
          { name: 'firefight_primary_skulls', type: 'i16' },
          { name: 'firefight_secondary_skulls', type: 'i16' },
          { name: 'pad', type: 'padding', count: 10 },
        ]});
        
        export const s_online_file_general_metadata = c.createCStruct({pack: 1, endian: 'big', fields: [
          { name: 'id', type: 'u64' }, // probs unique id
          { name: 'file_type', type: 'u8' },
          { name: 'tag_count', type: 'u8' }, // tag count?
          { name: 'megalo_category_index', type: 'u8' },
          PAD1,
          { name: 'size_in_bytes', type: 'u32' },
          { name: 'activity', type: 'u8' },
          { name: 'game_mode', type: 'u8' },
          { name: 'game_engine_type', type: 'u8' },
          PAD1,
          { name: 'unknown3', type: 'u8', count: 8 }, // game ID?
          { name: 'map_id', type: 'i32' },
        ]});
        
          export const s_online_file_metadata = c.createCStruct({pack: 1, endian: 'big', fields: [
          { name: 'general', type: s_online_file_general_metadata },
          { name: 'created', type: s_content_item_history },
          { name: 'modified', type: s_content_item_history },
          { name: 'name', type: new c.WString(128) },
          { name: 'description', type: new c.WString(128) },
          { name: 'game_variant_or_film', type: new c.Union({
            game_variant: s_content_item_game_variant_metadata,
            film: s_content_item_film_metadata,
            pad: c.createCStruct({pack: 1, endian: 'big', fields: [
              { name: 'pad', type: 'padding', count: 16 },
            ]}),
          }) },
          { name: 'matchmaking', type: new c.Union({
            metadata: s_content_item_matchmaking_metadata,
            pad: c.createCStruct({pack: 1, endian: 'big', fields: [
              { name: 'pad', type: 'padding', count: 16 },
            ]}),
          }) },
          { name: 'campaign_or_firefight', type: new c.Union({
            campaign: s_content_item_metadata_campaign_data,
            firefight: s_content_item_metadata_firefight_data,
            pad: c.createCStruct({pack: 1, endian: 'big', fields: [
              { name: 'pad', type: 'padding', count: 16 },
            ]})
          }) },
          { name: 'screenshot_length', type: 'u32' },
        ]});
        
        export const s_content_item_general_metadata = c.createCStruct({pack: 1, endian: 'big', fields: [
          { name: 'file_type', type: 'u8' },
          PAD1, PAD1, PAD1,
          { name: 'size_in_bytes', type: 'u32' },
          { name: 'unique_id', type: 'u64' },
          { name: 'parent_unique_id', type: 'u64' },
          { name: 'root_unique_id', type: 'u64' },
          { name: 'game_id', type: 'u64' },
          { name: 'activity', type: 'u8' },
          { name: 'game_mode', type: 'u8' },
          { name: 'game_engine_type', type: 'u8' },
          PAD1,
          { name: 'map_id', type: 'i32' },
        ]});
        
        export const c_content_item_metadata = c.createCStruct({pack: 1, endian: 'big', fields: [
          { name: 'general', type: s_online_file_general_metadata },
          { name: 'megalo_category_index', type: 'u8' }, // s_content_item_display_metadata ?
          PAD1, PAD1, PAD1, PAD1, 
          PAD1, PAD1, PAD1,
          { name: 'created', type: s_content_item_history },
          { name: 'modified', type: s_content_item_history },
          { name: 'name', type: new c.WString(128) },
          { name: 'description', type: new c.WString(128) },
          { name: 'game_variant_or_film', type: new c.Union({
            game_variant: s_content_item_game_variant_metadata,
            film: s_content_item_film_metadata,
            pad: c.createCStruct({pack: 1, endian: 'big', fields: [
              { name: 'pad', type: 'padding', count: 16 },
            ]}),
          }) },
          { name: 'matchmaking', type: new c.Union({
            metadata: s_content_item_matchmaking_metadata,
            pad: c.createCStruct({pack: 1, endian: 'big', fields: [
              { name: 'pad', type: 'padding', count: 16 },
            ]}),
          }) },
          { name: 'campaign_or_firefight', type: new c.Union({
            campaign: s_content_item_metadata_campaign_data,
            firefight: s_content_item_metadata_firefight_data,
            pad: c.createCStruct({pack: 1, endian: 'big', fields: [
              { name: 'pad', type: 'padding', count: 16 },
            ]})
          }) },
        ]});
        
        export const s_blf_chunk_content_header = blf.createChunkSchema({
          name: 'chdr',
          majorVersion: 10,
          minorVersion: 2,
          endian: 'big',
          pack: 1,
          fields: [
            { name: 'build_number', type: 'u16' },
            { name: 'map_minor_version', type: 'u16' },
            { name: 'metadata', type: c_content_item_metadata },
          ],
        });
        
        
        export const s_online_file_listing = (fileCount: number, messageLength: number) => c.createCStruct({pack: 1, endian: 'big', fields: [
          { name: 'xuid', type: 'u64' }, // this is a guess
          { name: 'gamertag', type: new c.String(16) },
          { name: 'unknown16', type: 'u8' },
          { name: 'unknown17', type: 'u8' },
          { name: 'unknown18', type: 'u8' },
          { name: 'unknown19', type: 'u8' },
          { name: 'quota_byte_count', type: 'u32' },
          { name: 'quota_slot_count', type: 'u8' },
          { name: 'pad', type: 'padding', count: 1 },
          { name: 'slot_count', type: 'u16' },
          { name: 'message_length', type: new c.MagicNumber(messageLength, 'u8') },
          { name: 'pad', type: 'padding', count: 3 },
          { name: 'entries', count: fileCount, type: s_online_file_metadata },
          { name: 'message', type: new c.WString(messageLength + 1) },
        ]});
        
        export const s_blf_chunk_start_of_file = blf.createChunkSchema({
          name: '_blf',
          majorVersion: 1,
          minorVersion: 2,
          endian: 'big',
          pack: 1,
          fields: [
            { name: 'byte_order_mark', type: 'u16' },
            { name: 'name', type: new c.String(0x22) },
          ],
        });
        
        export const s_blf_chunk_end_of_file = blf.createChunkSchema({
          name: '_eof',
          majorVersion: 1,
          minorVersion: 1,
          endian: 'big',
          pack: 1,
          fields: [
            { name: 'file_size', type: 'u32' },
            { name: 'authentication_type', type: new c.MagicNumber(0, 'u8') },
          ],
        });

        export const s_online_file_tag = c.createCStruct({pack: 1, endian: 'big', fields: [
          { name: 'tag', type: new c.String(23) },
          { name: 'unknown', type: 'u32' },
        ]});

        const s_queried_player_hopper_statistics = c.createCStruct({
          endian: 'big',
          pack: 1,
          fields: [
              { name: 'valid', type: 'i8' },
              { name: 'hopper_id', type: 'i16' },
              { name: 'hopper_mu', type: 'i32' },
              { name: 'hopper_sigma', type: 'i32' },
              { name: 'games_played', type: 'i32' },
              { name: 'games_won', type: 'i32' },
          ],
        });

        const s_player_appearance = c.createCStruct({
          endian: 'big',
          pack: 1,
          fields: [
              { name: 'voice', type: 'i8' },
              { name: 'primary_color', type: 'i8' },
              { name: 'secondary_color', type: 'i8' },
              { name: 'tertiary_color', type: 'i8' },
              { name: 'player_model_choice', type: 'i8' },
              PAD1, PAD1, PAD1,
              { name: 'foreground_emblem', type: 'i8' },
              { name: 'background_emblem', type: 'u8' },
              { name: 'emblem_flags', type: 'u8' },
              { name: 'emblem_primary_color', type: 'i8' },
              { name: 'emblem_secondary_color', type: 'i8' },
              { name: 'emblem_background_color', type: 'i8' },
              PAD1, PAD1,
              { name: 'model_permutations', type: 'i8', count: 8 },
              { name: 'non_model_customization', type: 'i8', count: 4 },
              { name: 'service_tag', type: new c.WString(5) },
              PAD1, PAD1,
          ],
        });

        const s_queried_player_hopper_lsp_statistics = c.createCStruct({
          endian: 'big',
          pack: 1,
          fields: [
              { name: 'flags', type: 'i8' },
              { name: 'hopper_identifier', type: 'u16' },
              { name: 'hopper_day', type: 'i16' },
              { name: 'qualified_games_played_today', type: 'u32' },
              { name: 'qualifying_days_this_season', type: 'u32' },
              { name: 'required_qualifying_daily_games_for_rating', type: 'u32' },
              { name: 'required_qualifying_days_for_tier', type: 'u32' },
              { name: 'tier', type: 'i16' },
              { name: 'tier_pct', type: 'i16' },
              { name: 'day_rating', type: 'u32' },
          ],
        });

        const s_player_challenge_state = c.createCStruct({
          endian: 'big',
          pack: 4,
          fields: [
              { name: 'flags', type: 'u8' },
              { name: 'daily_completed_count', type: 'u32' },
              { name: 'daily_count', type: 'u32' },
              { name: 'weekly_completed_count', type: 'u32' },
              { name: 'weekly_count', type: 'u32' },
          ]
        })

        const s_player_configuration_from_client = c.createCStruct({
          endian: 'big',
          pack: 1,
          fields: [
              { name: 'desired_name', type: new c.WString(16) },
              { name: 'xuid', type: 'i64' },
              { name: 'appearance', type: s_player_appearance },
              { name: 'flags', type: 'u16' },
              { name: 'user_selected_multiplayer_team', type: 'i8' },
              { name: 'hopper_access_flags', type: 'i8' },
              { name: 'campaign_highest_difficulty', type: 'i8' },
              { name: 'supply_depot_pct', type: 'i8' },
              { name: 'commendation_unlock_pct', type: 'i8' },
              { name: 'grade', type: 'i8' },
              { name: 'sub_grade', type: 'i8' },
              PAD1,
              { name: 'bnet_flags', type: 'u16' },
              { name: 'cheat_flags', type: 'i8' },
              PAD1,
              { name: 'ban_flags', type: 'u16' },
              { name: 'repeated_play_coefficient', type: 'i32' },
              { name: 'global_stats_valid', type: 'i8' },
              PAD1,
              { name: 'matchmade_games_played', type: 'u32' },
              { name: 'hopper_stats', type: s_queried_player_hopper_statistics },
              { name: 'lsp_stats', type: s_queried_player_hopper_lsp_statistics },
              PAD1, PAD1, PAD1, PAD1, // ?
              { name: 'challenge_state', type: s_player_challenge_state },
              PAD1, PAD1, PAD1, PAD1, // ?
          ],
        });

        const s_player_configuration_from_host = c.createCStruct({
          endian: 'big',
          pack: 1,
          fields: [
              { name: 'player_name', type: new c.WString(16) },
              { name: 'team', type: 'i8' },
              { name: 'assigned_team', type: 'i8' },
              { name: 'pad_align_hopper_stats_valid', type: 'padding', count: 2 },
              { name: 'hopper_stats_valid', type: 'u8' },
              { name: 'pad_before_hopper_skill', type: 'padding', count: 3 },
              { name: 'hopper_skill', type: 'u32' },
              { name: 'hopper_weight', type: 'u32' },
          ],
        });

        const s_blf_chunk_multiplayer_players_player = c.createCStruct({
          endian: 'big',
          pack: 1,
          fields: [
              { name: 'player_exists', type: 'u8' },
              { name: 'machine_identifier', type: 'u8', count: 6 },
              { name: 'player_identifier', type: 'u64' },
              PAD1,
              { name: 'player_configuration_from_client', type: s_player_configuration_from_client },
              { name: 'player_configuration_from_host', type: s_player_configuration_from_host },
              { name: 'standing', type: 'i8' },
              PAD1, PAD1, PAD1,
              { name: 'relative_scores', type: 'u32', count: 16 },
              { name: 'result', type: 'i8' },
              PAD1,
              { name: 'score', type: 'i16' },
          ],
        });

        export const s_blf_chunk_multiplayer_players = blf.createChunkSchema({
          majorVersion: 8,
          minorVersion: 1,
          name: 'mppl',
          endian: 'big',
          fields: [
              PAD1, PAD1, PAD1, PAD1,
              { name: 'players', type: s_blf_chunk_multiplayer_players_player, count: 16 },
          ],
        })

        export const s_blf_chunk_author = blf.createChunkSchema({
          majorVersion: 3,
          minorVersion: 1,
          name: 'athr',
          endian: 'big',
          fields: [
            { name: 'program_name', type: new c.String(16) },
            { name: 'build_number_sequence', type: 'i32' },
            { name: 'build_number', type: 'i32' },
            { name: 'build_string', type: new c.String(28) },
            { name: 'author_name', type: new c.WString(16) },
          ],
        });
    }
}