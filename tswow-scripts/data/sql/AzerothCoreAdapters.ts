/*
 * This file is part of tswow (https://github.com/tswow)
 *
 * Copyright (C) 2020 tswow <https://github.com/tswow/>
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License, version 3.
 */
import { EmulatorCore } from '../Settings';
import { SqlConnection } from './SQLConnection';

/**
 * Writes TSWoW's combined race/class stats back to AzerothCore's normalized
 * class-stat table. AzerothCore can only represent a single class value plus a
 * fixed race offset, so reject incompatible per-race edits instead of losing
 * them silently.
 */
export function applyAzerothCoreAdapters() {
    if(EmulatorCore !== 'azerothcore') return;

    const missingRaceOffsets = SqlConnection.world_dst.read(`
        SELECT DISTINCT stats.race
        FROM player_levelstats stats
        LEFT JOIN player_race_stats race_stats ON race_stats.Race = stats.race
        WHERE race_stats.Race IS NULL
        LIMIT 1;
    `);
    if(missingRaceOffsets.length > 0) {
        throw new Error(
            `AzerothCore cannot import player_levelstats for race ${missingRaceOffsets[0].race}: `
          + `player_race_stats has no offset row for that race.`
        );
    }

    SqlConnection.world_dst.read(`
        UPDATE player_class_stats class_stats
        JOIN (
            SELECT
              stats.class,
              stats.level,
              MIN(stats.str - race_stats.Strength) AS Strength,
              MIN(stats.agi - race_stats.Agility) AS Agility,
              MIN(stats.sta - race_stats.Stamina) AS Stamina,
              MIN(stats.inte - race_stats.Intellect) AS Intellect,
              MIN(stats.spi - race_stats.Spirit) AS Spirit
            FROM player_levelstats stats
            JOIN player_race_stats race_stats ON race_stats.Race = stats.race
            GROUP BY stats.class, stats.level
        ) normalized
          ON normalized.class = class_stats.Class
         AND normalized.level = class_stats.Level
        SET class_stats.Strength = normalized.Strength,
            class_stats.Agility = normalized.Agility,
            class_stats.Stamina = normalized.Stamina,
            class_stats.Intellect = normalized.Intellect,
            class_stats.Spirit = normalized.Spirit;
    `);

    SqlConnection.world_dst.read(`
        DELETE model
        FROM creature_template_model model
        JOIN creature_template template ON template.entry = model.CreatureID
        WHERE model.Idx <= 3
          AND CASE model.Idx
                WHEN 0 THEN template.modelid1
                WHEN 1 THEN template.modelid2
                WHEN 2 THEN template.modelid3
                WHEN 3 THEN template.modelid4
              END = 0;

        INSERT INTO creature_template_model
          (CreatureID, Idx, CreatureDisplayID, DisplayScale, Probability, VerifiedBuild)
        SELECT entry, 0, modelid1, scale, 1, VerifiedBuild
          FROM creature_template WHERE modelid1 <> 0
        UNION ALL
        SELECT entry, 1, modelid2, scale, 1, VerifiedBuild
          FROM creature_template WHERE modelid2 <> 0
        UNION ALL
        SELECT entry, 2, modelid3, scale, 1, VerifiedBuild
          FROM creature_template WHERE modelid3 <> 0
        UNION ALL
        SELECT entry, 3, modelid4, scale, 1, VerifiedBuild
          FROM creature_template WHERE modelid4 <> 0
        ON DUPLICATE KEY UPDATE
          CreatureDisplayID = VALUES(CreatureDisplayID),
          DisplayScale = VALUES(DisplayScale);

        INSERT INTO creature_immunities
          (ID, SchoolMask, DispelTypeMask, MechanicsMask, Effects, Auras,
           ImmuneAoE, ImmuneChain, Comment)
        SELECT maximum.max_id + ROW_NUMBER() OVER (ORDER BY masks.SchoolMask, masks.MechanicsMask),
               masks.SchoolMask, 0, masks.MechanicsMask, '', '', 0, 0,
               'Generated from TSWoW creature_template compatibility fields'
        FROM (
            SELECT DISTINCT spell_school_immune_mask AS SchoolMask,
                            mechanic_immune_mask AS MechanicsMask
            FROM creature_template
            WHERE spell_school_immune_mask <> 0 OR mechanic_immune_mask <> 0
        ) masks
        CROSS JOIN (
            SELECT GREATEST(COALESCE(MAX(ID), 0), 0) AS max_id
            FROM creature_immunities
        ) maximum
        LEFT JOIN creature_immunities existing
          ON existing.SchoolMask = masks.SchoolMask
         AND existing.MechanicsMask = masks.MechanicsMask
         AND existing.DispelTypeMask = 0
         AND existing.Effects = ''
         AND existing.Auras = ''
         AND existing.ImmuneAoE = 0
         AND existing.ImmuneChain = 0
        WHERE existing.ID IS NULL;

        UPDATE creature_template template
        LEFT JOIN creature_immunities immunities
          ON immunities.SchoolMask = template.spell_school_immune_mask
         AND immunities.MechanicsMask = template.mechanic_immune_mask
         AND immunities.DispelTypeMask = 0
         AND immunities.Effects = ''
         AND immunities.Auras = ''
         AND immunities.ImmuneAoE = 0
         AND immunities.ImmuneChain = 0
        SET template.CreatureImmunitiesId =
          CASE
            WHEN template.spell_school_immune_mask = 0
             AND template.mechanic_immune_mask = 0 THEN 0
            ELSE immunities.ID
          END;
    `);
}
