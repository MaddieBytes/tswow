import { isTrinityCore } from "../Settings";

export type TranslateDirection = 'IN'|'OUT'
export type TranslateContext = 'ROW'|'QUERY'

export function translate(
    table: string,
    row: any,
    direction: TranslateDirection,
    context: TranslateContext = 'ROW'
) {
    if(isTrinityCore()) return;

    const rename = (from: string, to: string)=>{
        if(direction === 'IN') {
            if(row[from] === undefined) return;
            row[to] = row[from];
            delete row[from];
        } else {
            if(row[to] === undefined) return;
            row[from] = row[to];
            delete row[to];
        }
    }

    const add_out = (key: string, value: any) => {
        if(direction === 'OUT' && context === 'ROW') {
            row[key] = value;
        }
    }

    const remove_out = (key: string) => {
        if(direction !== 'OUT' || row[key] === undefined) return;
        if(context === 'QUERY') {
            throw new Error(
                `AzerothCore does not support querying TSWoW field ${table}.${key}`
            );
        }
        delete row[key];
    }

    const creatureAddonBytes = () => {
        const fields = ['StandState','AnimTier','VisFlags','SheathState','PvPFlags'];
        if(direction === 'IN') {
            const bytes1 = Number(row.bytes1 || 0) >>> 0;
            const bytes2 = Number(row.bytes2 || 0) >>> 0;
            row.StandState = bytes1 & 0xff;
            row.VisFlags = (bytes1 >>> 16) & 0xff;
            row.AnimTier = (bytes1 >>> 24) & 0xff;
            row.SheathState = bytes2 & 0xff;
            row.PvPFlags = (bytes2 >>> 8) & 0xff;
            delete row.bytes1;
            delete row.bytes2;
            return;
        }
        if(context === 'QUERY' && fields.some(key=>row[key] !== undefined)) {
            throw new Error(
                `AzerothCore does not support querying individual packed fields on ${table}`
            );
        }
        if(context === 'ROW') {
            row.bytes1 = (
                (Number(row.StandState || 0) & 0xff)
              | ((Number(row.VisFlags || 0) & 0xff) << 16)
              | ((Number(row.AnimTier || 0) & 0xff) << 24)
            ) >>> 0;
            row.bytes2 = (
                (Number(row.SheathState || 0) & 0xff)
              | ((Number(row.PvPFlags || 0) & 0xff) << 8)
            ) >>> 0;
            fields.forEach(key=>delete row[key]);
        }
    }

    switch(table) {
        case 'broadcast_text':
            rename('MaleText','Text');
            rename('FemaleText','Text1');
            rename('SoundEntriesId','SoundEntriesID')
            break;
        case 'broadcast_text_locale':
            rename('MaleText','Text');
            rename('FemaleText','Text1');
            break;
        case 'creature':
            rename('id1','id')
            add_out('id2',0)
            add_out('id3',0)
            remove_out('modelid')
            break;
        case 'game_event_battleground_holiday':
            rename('eventEntry','EventEntry')
            remove_out('BattlegroundID')
            break;
        case 'event_scripts':
            remove_out('Comment')
            break;
        case 'creature_addon':
            remove_out('MountCreatureID')
            creatureAddonBytes();
            break;
        case 'creature_summon_groups':
            remove_out('Comment')
            break;
        case 'creature_template_addon':
            remove_out('MountCreatureID')
            creatureAddonBytes();
            break;
        case 'npc_text':
            for(let x = 0; x <= 7; ++x) {
                for(let y = 0; y <= 5; ++y) {
                    rename(`em${x}_${y}`,`Emote${x}_${y}`)
                    remove_out(`EmoteDelay${x}_${y}`)
                }
            }
            break;
        case 'item_template':
            if(direction === 'IN') {
                row.StatsCount = Array.from({length:10},(_,index)=>index+1)
                    .filter(index=>Number(row[`stat_type${index}`] || 0) !== 0)
                    .length;
            } else {
                remove_out('StatsCount');
            }
            break;
        case 'player_factionchange_items':
            rename('alliance_comment','commentA');
            rename('horde_comment','commentH');
            remove_out('race_A')
            remove_out('race_H')
            break;
        case 'player_factionchange_spells':
            add_out('alliance_comment','')
            add_out('horde_comment','')
            break;
        case 'player_factionchange_titles':
            add_out('alliance_comment','')
            add_out('horde_comment','')
            break;
        case 'spell_group_stack_rules':
            add_out('description','')
            break;
        case 'playercreateinfo_item':
            add_out('Note','')
            break;
        case 'npc_vendor':
            remove_out('raceMask')
            remove_out('classMask')
            break;
        case 'game_event_condition':
            remove_out('auto_broadcast')
            break;
        case 'gossip_menu':
            remove_out('VerifiedBuild')
            break;
        case 'spell_custom_attr':
            rename('spell_id','entry')
            break;
        case 'spell_enchant_proc_data':
            rename('entry','EnchantID')
            rename('customChance','Chance');
            rename('PPMChance','ProcsPerMinute')
            rename('procEx','AttributesMask')
            remove_out('HitMask')
            break;
        case 'spell_proc':
            rename('spellId','SpellId')
            rename('schoolMask','SchoolMask')
            rename('spellFamilyName','SpellFamilyName')
            rename('spellFamilyMask0','SpellFamilyMask0')
            rename('spellFamilyMask1','SpellFamilyMask1')
            rename('spellFamilyMask2','SpellFamilyMask2')
            rename('spellTypeMask','SpellTypeMask')
            rename('spellPhaseMask','SpellPhaseMask')
            rename('hitMask','HitMask')
            rename('attributesMask','AttributesMask')
            rename('ratePerMinute','ProcsPerMinute')
            rename('chance','Chance')
            rename('cooldown','Cooldown')
            rename('charges','Charges')
            remove_out('ProcFlags')
            remove_out('DisableEffectsMask')
            break;
        case 'areatrigger_teleport':
            remove_out('VerifiedBuild')
            break;
        case 'achievement_reward_locale':
            rename('Text','Body')
            break;
        case 'gameobject_addon':
            remove_out('parent_rotation0')
            remove_out('parent_rotation1')
            remove_out('parent_rotation2')
            remove_out('parent_rotation3')
            break;
        case 'gameobject_template_addon':
            remove_out('artkit0')
            remove_out('artkit1')
            remove_out('artkit2')
            remove_out('artkit3')
            break;
        case 'spell_scripts':
            remove_out('Comment')
            break;
        case 'waypoint_scripts':
            remove_out('Comment')
            break;
        case 'quest_template_addon':
            remove_out('BreadcrumbForQuestId')
            break;
        case 'points_of_interest':
            remove_out('VerifiedBuild')
            break;
        case 'quest_template':
            rename('RewardMoneyDifficulty','RewardBonusMoney');
            break;
    }
}
