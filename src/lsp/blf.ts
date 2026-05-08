import { blf } from "src/blf";
import { c } from "src/cstruct";
import { PAD1 } from "src/cstruct/macros";
import { time64_t } from "src/cstruct/time";

export namespace HaloReach {
    export namespace v12065 {
        export const s_online_file_summary_listing_entry = c.createCStruct({pack: 1, endian: 'big', fields: [
          {name: 'share_id', type: 'u64'},
          {name: 'screenshots_count', type: 'u32'},
          {name: 'films_count', type: 'u32'},
          {name: 'map_variants_count', type: 'u32'},
          {name: 'game_variants_count', type: 'u32'},
          {name: 'unknown18', type: 'u32'},
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
            { name: 'unknown1', type: 'u8', count: 1 },
            { name: 'megalo_category_index', type: 'u8' },
            { name: 'unknown2', type: 'u8', count: 1 },
            { name: 'size_in_bytes', type: 'u32' },
            { name: 'activity', type: 'u8' },
            { name: 'game_mode', type: 'u8' },
            { name: 'game_engine_type', type: 'u8' },
            { name: 'unknown3', type: 'padding', count: 1 },
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
            { name: 'unknown', type: 'u32'}, // probs tag count
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
              { name: 'padding', type: 'padding', count: 2 },
              { name: 'name', type: new c.WString(32) },
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
    }
}