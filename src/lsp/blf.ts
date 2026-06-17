import { blf } from "src/blf";
import { c } from "src/cstruct";
import { time64_t } from "src/cstruct/time";

export namespace HaloReach {
    export namespace v12065 {
        export const unionPad16 = c.struct({
            pad: c.pad(16),
        });
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

        export const s_online_file_summary_listing_entry = c.struct({
          share_id: c.u64(),
          screenshots_count: c.u32(),
          films_count: c.u32(),
          game_variants_count: c.u32(),
          map_variants_count: c.u32(),
          new_items_count: c.u32(),
          unknown1C: c.u32(),
          unknown20: c.u32(),
        });

        export const s_content_item_history = c.struct({
          timestamp: new time64_t(),
          xuid: c.u64(),
          name: c.String(16, 'latin1'),
          is_online: c.u8({ padAfter: 3 }),
        });
        
        export const s_content_item_game_variant_metadata = c.struct({
          icon_index: c.i8(),
        });
        
        export const s_content_item_film_metadata = c.struct({
          seconds: c.i32(),
        });
        // i think theres one for forge too but idk where
        
        export const s_content_item_matchmaking_metadata = c.struct({
          hopper_identifier: c.u16(),
        });
        
        export const s_content_item_metadata_campaign_data = c.struct({
          campaign_id: c.i32(),
          campaign_difficulty: c.i16(),
          campaign_metagame_scoring: c.i16(),
          campaign_insertion_point: c.i32(),
          campaign_primary_skulls: c.i16(),
          campaign_secondary_skulls: c.i16(),
        });
        
        export const s_content_item_metadata_firefight_data = c.struct({
          firefight_difficulty: c.i16(),
          firefight_primary_skulls: c.i16(),
          firefight_secondary_skulls: c.i16({ padAfter: 10 }),
        });
        
        export const s_online_file_general_metadata = c.struct({
          id: c.u64(), // probs unique id
          file_type: c.u8(),
          tag_count: c.u8(), // tag count?
          megalo_category_index: c.u8({ padAfter: 1 }),
          size_in_bytes: c.u32(),
          activity: c.u8(),
          game_mode: c.u8(),
          game_engine_type: c.u8({ padAfter: 1 }),
          unknown3: c.array(c.u8(), 8), // game ID?
          map_id: c.i32(),
        });
        
          export const s_online_file_metadata = c.struct({
          general: s_online_file_general_metadata.field(),
          created: s_content_item_history.field(),
          modified: s_content_item_history.field(),
          name: c.WString(128),
          description: c.WString(128),
          game_variant_or_film: c.Union({
            game_variant: s_content_item_game_variant_metadata,
            film: s_content_item_film_metadata,
            pad: unionPad16,
          }),
          matchmaking: c.Union({
            metadata: s_content_item_matchmaking_metadata,
            pad: unionPad16,
          }),
          campaign_or_firefight: c.Union({
            campaign: s_content_item_metadata_campaign_data,
            firefight: s_content_item_metadata_firefight_data,
            pad: unionPad16,
          }),
          screenshot_length: c.u32(),
        });
        
        export const s_content_item_general_metadata = c.struct({
          file_type: c.u8({ padAfter: 3 }),
          size_in_bytes: c.u32(),
          unique_id: c.u64(),
          parent_unique_id: c.u64(),
          root_unique_id: c.u64(),
          game_id: c.u64(),
          activity: c.u8(),
          game_mode: c.u8(),
          game_engine_type: c.u8({ padAfter: 1 }),
          map_id: c.i32(),
        });
        
        export const c_content_item_metadata = c.struct({
          general: s_online_file_general_metadata.field(),
          megalo_category_index: c.u8({ padAfter: 7 }),
          created: s_content_item_history.field(),
          modified: s_content_item_history.field(),
          name: c.WString(128),
          description: c.WString(128),
          game_variant_or_film: c.Union({
            game_variant: s_content_item_game_variant_metadata,
            film: s_content_item_film_metadata,
            pad: unionPad16,
          }),
          matchmaking: c.Union({
            metadata: s_content_item_matchmaking_metadata,
            pad: unionPad16,
          }),
          campaign_or_firefight: c.Union({
            campaign: s_content_item_metadata_campaign_data,
            firefight: s_content_item_metadata_firefight_data,
            pad: unionPad16,
          }),
        });
        
        export const s_blf_chunk_content_header = blf.createChunkSchema({
          name: 'chdr',
          majorVersion: 10,
          minorVersion: 2,
          endian: 'big',
          fields: {
            build_number: c.u16(),
            build_sequence_number: c.u16(),
            metadata: c_content_item_metadata.field(),
          },
        });
        
        
        export const s_online_file_listing = (fileCount: number, messageLength: number) => c.struct({
          xuid: c.u64(), // this is a guess
          gamertag: c.String(16),
          unknown16: c.u8(),
          unknown17: c.u8(),
          unknown18: c.u8(),
          unknown19: c.u8(),
          quota_byte_count: c.u32(),
          quota_slot_count: c.u8({ padAfter: 1 }),
          slot_count: c.u16(),
          message_length: c.MagicNumber(messageLength, c.u8(), { padAfter: 3 }),
          entries: c.array(s_online_file_metadata.field(), fileCount),
          message: c.WString(messageLength + 1),
        });
        
        export const s_blf_chunk_start_of_file = blf.createChunkSchema({
          name: '_blf',
          majorVersion: 1,
          minorVersion: 2,
          endian: 'big',
          fields: {
            byte_order_mark: c.u16(),
            name: c.String(0x22),
          },
        });
        
        export const s_blf_chunk_end_of_file = blf.createChunkSchema({
          name: '_eof',
          majorVersion: 1,
          minorVersion: 1,
          endian: 'big',
          fields: {
            file_size: c.u32(),
            authentication_type: c.MagicNumber(0, c.u8()),
          },
        });

        export const s_online_file_tag = c.struct({
          tag: c.String(23),
          unknown: c.u32(),
        });

        export const s_blf_chunk_author = blf.createChunkSchema({
          majorVersion: 3,
          minorVersion: 1,
          name: 'athr',
          endian: 'big',
          fields: {
            program_name: c.String(16),
            build_number_sequence: c.i32(),
            build_number: c.i32(),
            build_string: c.String(28),
            author_name: c.WString(16),
          },
        });
    }
}
