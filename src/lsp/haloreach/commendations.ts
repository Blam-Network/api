import { reach_commendation } from "@prisma/client"

export enum HaloReachCommendation {
    matchmaking_oneshot = 0,
    matchmaking_multikill = 1,
    matchmaking_anyspree = 2,
    matchmaking_assistant = 3,
    matchmaking_crackshot = 4,
    matchmaking_closequarters = 5,
    matchmaking_downshift = 6,
    matchmaking_triggerman = 7,
    matchmaking_sidearm = 8,
    matchmaking_heavyweapon = 9,
    matchmaking_mobileasset = 10,
    matchmaking_grenadier = 11,
    matchmaking_rearadmiral = 12,
    matchmaking_jackofalltrades = 13,

    firefight_domeinspector = 14,
    firefight_numbersgame = 15,
    firefight_targetpractice = 16,
    firefight_specialized = 17,
    firefight_incommand = 18,
    firefight_longshot = 19,
    firefight_riflinthrough = 20,
    firefight_triggerhappy = 21,
    firefight_pullthepin = 22,
    firefight_getloud = 23,
    firefight_methodical = 24,
    firefight_backup = 25,
    firefight_vehicular = 26,
    firefight_grounded = 27,
    firefight_perfectionist = 28,

    campaign_pinpoint = 29,
    campaign_demon = 30,
    campaign_cannonfodder = 31,
    campaign_specops = 32,
    campaign_leadershipelement = 33,
    campaign_walkingtank = 34,
    campaign_precisely = 35,
    campaign_standardissue = 36,
    campaign_smallarms = 37,
    campaign_nicearm = 38,
    campaign_warmachine = 39,
    campaign_splashdamage = 40,
    campaign_supersoldier = 41,
    campaign_supportrole = 42,
    campaign_rightofway = 43,
    campaign_flawlesscowboy = 44,
}

export const MATCHMAKING_COMMENDATIONS = [
    HaloReachCommendation.matchmaking_oneshot,
    HaloReachCommendation.matchmaking_multikill,
    HaloReachCommendation.matchmaking_anyspree,
    HaloReachCommendation.matchmaking_assistant,
    HaloReachCommendation.matchmaking_crackshot,
    HaloReachCommendation.matchmaking_closequarters,
    HaloReachCommendation.matchmaking_downshift,
    HaloReachCommendation.matchmaking_triggerman,
    HaloReachCommendation.matchmaking_sidearm,
    HaloReachCommendation.matchmaking_heavyweapon,
    HaloReachCommendation.matchmaking_mobileasset,
    HaloReachCommendation.matchmaking_grenadier,
    HaloReachCommendation.matchmaking_rearadmiral,
    HaloReachCommendation.matchmaking_jackofalltrades,
]

export const FIREFIGHT_COMMENDATIONS = [
    HaloReachCommendation.firefight_domeinspector,
    HaloReachCommendation.firefight_numbersgame,
    HaloReachCommendation.firefight_targetpractice,
    HaloReachCommendation.firefight_specialized,
    HaloReachCommendation.firefight_incommand,
    HaloReachCommendation.firefight_longshot,
    HaloReachCommendation.firefight_riflinthrough,
    HaloReachCommendation.firefight_triggerhappy,
    HaloReachCommendation.firefight_pullthepin,
    HaloReachCommendation.firefight_getloud,
    HaloReachCommendation.firefight_methodical,
    HaloReachCommendation.firefight_backup,
    HaloReachCommendation.firefight_vehicular,
    HaloReachCommendation.firefight_grounded,
    HaloReachCommendation.firefight_perfectionist,
]

export const CAMPAIGN_COMMENDATIONS = [
    HaloReachCommendation.campaign_pinpoint,
    HaloReachCommendation.campaign_demon,
    HaloReachCommendation.campaign_cannonfodder,
    HaloReachCommendation.campaign_specops,
    HaloReachCommendation.campaign_leadershipelement,
    HaloReachCommendation.campaign_walkingtank,
    HaloReachCommendation.campaign_precisely,
    HaloReachCommendation.campaign_standardissue,
    HaloReachCommendation.campaign_smallarms,
    HaloReachCommendation.campaign_nicearm,
    HaloReachCommendation.campaign_warmachine,
    HaloReachCommendation.campaign_splashdamage,
    HaloReachCommendation.campaign_supersoldier,
    HaloReachCommendation.campaign_supportrole,
    HaloReachCommendation.campaign_rightofway,
    HaloReachCommendation.campaign_flawlesscowboy,
]

export const ALL_COMMENDATIONS = [
    ...MATCHMAKING_COMMENDATIONS,
    ...FIREFIGHT_COMMENDATIONS,
    ...CAMPAIGN_COMMENDATIONS
]

export const COMMENDATION_TO_DB: Record<HaloReachCommendation, reach_commendation> = {
    [HaloReachCommendation.matchmaking_oneshot]: reach_commendation.matchmaking_oneshot,
    [HaloReachCommendation.matchmaking_multikill]: reach_commendation.matchmaking_multikill,
    [HaloReachCommendation.matchmaking_anyspree]: reach_commendation.matchmaking_anyspree,
    [HaloReachCommendation.matchmaking_assistant]: reach_commendation.matchmaking_assistant,
    [HaloReachCommendation.matchmaking_crackshot]: reach_commendation.matchmaking_crackshot,
    [HaloReachCommendation.matchmaking_closequarters]: reach_commendation.matchmaking_closequarters,
    [HaloReachCommendation.matchmaking_downshift]: reach_commendation.matchmaking_downshift,
    [HaloReachCommendation.matchmaking_triggerman]: reach_commendation.matchmaking_triggerman,
    [HaloReachCommendation.matchmaking_sidearm]: reach_commendation.matchmaking_sidearm,
    [HaloReachCommendation.matchmaking_heavyweapon]: reach_commendation.matchmaking_heavyweapon,
    [HaloReachCommendation.matchmaking_mobileasset]: reach_commendation.matchmaking_mobileasset,
    [HaloReachCommendation.matchmaking_grenadier]: reach_commendation.matchmaking_grenadier,
    [HaloReachCommendation.matchmaking_rearadmiral]: reach_commendation.matchmaking_rearadmiral,
    [HaloReachCommendation.matchmaking_jackofalltrades]: reach_commendation.matchmaking_jackofalltrades,
    [HaloReachCommendation.firefight_domeinspector]: reach_commendation.firefight_domeinspector,
    [HaloReachCommendation.firefight_numbersgame]: reach_commendation.firefight_numbersgame,
    [HaloReachCommendation.firefight_targetpractice]: reach_commendation.firefight_targetpractice,
    [HaloReachCommendation.firefight_specialized]: reach_commendation.firefight_specialized,
    [HaloReachCommendation.firefight_incommand]: reach_commendation.firefight_incommand,
    [HaloReachCommendation.firefight_longshot]: reach_commendation.firefight_longshot,
    [HaloReachCommendation.firefight_riflinthrough]: reach_commendation.firefight_riflinthrough,
    [HaloReachCommendation.firefight_triggerhappy]: reach_commendation.firefight_triggerhappy,
    [HaloReachCommendation.firefight_pullthepin]: reach_commendation.firefight_pullthepin,
    [HaloReachCommendation.firefight_getloud]: reach_commendation.firefight_getloud,
    [HaloReachCommendation.firefight_methodical]: reach_commendation.firefight_methodical,
    [HaloReachCommendation.firefight_backup]: reach_commendation.firefight_backup,
    [HaloReachCommendation.firefight_vehicular]: reach_commendation.firefight_vehicular,
    [HaloReachCommendation.firefight_grounded]: reach_commendation.firefight_grounded,
    [HaloReachCommendation.firefight_perfectionist]: reach_commendation.firefight_perfectionist,
    [HaloReachCommendation.campaign_pinpoint]: reach_commendation.campaign_pinpoint,
    [HaloReachCommendation.campaign_demon]: reach_commendation.campaign_demon,
    [HaloReachCommendation.campaign_cannonfodder]: reach_commendation.campaign_cannonfodder,
    [HaloReachCommendation.campaign_specops]: reach_commendation.campaign_specops,
    [HaloReachCommendation.campaign_leadershipelement]: reach_commendation.campaign_leadershipelement,
    [HaloReachCommendation.campaign_walkingtank]: reach_commendation.campaign_walkingtank,
    [HaloReachCommendation.campaign_precisely]: reach_commendation.campaign_precisely,
    [HaloReachCommendation.campaign_standardissue]: reach_commendation.campaign_standardissue,
    [HaloReachCommendation.campaign_smallarms]: reach_commendation.campaign_smallarms,
    [HaloReachCommendation.campaign_nicearm]: reach_commendation.campaign_nicearm,
    [HaloReachCommendation.campaign_warmachine]: reach_commendation.campaign_warmachine,
    [HaloReachCommendation.campaign_splashdamage]: reach_commendation.campaign_splashdamage,
    [HaloReachCommendation.campaign_supersoldier]: reach_commendation.campaign_supersoldier,
    [HaloReachCommendation.campaign_supportrole]: reach_commendation.campaign_supportrole,
    [HaloReachCommendation.campaign_rightofway]: reach_commendation.campaign_rightofway,
    [HaloReachCommendation.campaign_flawlesscowboy]: reach_commendation.campaign_flawlesscowboy,
}

export const COMMENDATIONS_FROM_DB_MAP = Object.fromEntries(
  Object.entries(COMMENDATION_TO_DB).map(([key, value]) => [value, Number(key)])
) as Record<(typeof reach_commendation)[keyof typeof reach_commendation], HaloReachCommendation>;

export function isValidHaloReachCommendation(value: number): value is HaloReachCommendation {
  return Object.values(HaloReachCommendation)
    .filter((v) => typeof v === "number")
    .includes(value);
}

export function toHaloReachCommendation(value: number): HaloReachCommendation | undefined {
  return isValidHaloReachCommendation(value) ? (value as HaloReachCommendation) : undefined;
}