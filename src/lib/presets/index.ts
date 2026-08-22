import { BUNDLED_NETWORKS } from "./groups";
import { RouteCatalog } from "./catalog";
import { LegacyRoute, upgradeLegacyCatalog } from "./legacy";
import { northeastRegional } from "./routes/amtrak/northeast-regional";
import { acela } from "./routes/amtrak/acela";
import { keystoneService } from "./routes/amtrak/keystone-service";
import { pennsylvanian } from "./routes/amtrak/pennsylvanian";
import { vermonter } from "./routes/amtrak/vermonter";
import { ethanAllenExpress } from "./routes/amtrak/ethan-allen-express";
import { adirondack } from "./routes/amtrak/adirondack";
import { empireService } from "./routes/amtrak/empire-service";
import { mapleLeaf } from "./routes/amtrak/maple-leaf";
import { downeaster } from "./routes/amtrak/downeaster";
import { cardinal } from "./routes/amtrak/cardinal";
import { crescent } from "./routes/amtrak/crescent";
import { silverStar } from "./routes/amtrak/silver-star";
import { silverMeteor } from "./routes/amtrak/silver-meteor";
import { palmetto } from "./routes/amtrak/palmetto";
import { carolinian } from "./routes/amtrak/carolinian";
import { piedmont } from "./routes/amtrak/piedmont";
import { autoTrain } from "./routes/amtrak/auto-train";
import { lakeShoreLimited } from "./routes/amtrak/lake-shore-limited";
import { wolverine } from "./routes/amtrak/wolverine";
import { blueWater } from "./routes/amtrak/blue-water";
import { illiniSaluki } from "./routes/amtrak/illini-saluki";
import { pereMarquette } from "./routes/amtrak/pere-marquette";
import { lincolnService } from "./routes/amtrak/lincoln-service";
import { missouriRiverRunner } from "./routes/amtrak/missouri-river-runner";
import { hiawatha } from "./routes/amtrak/hiawatha";
import { borealis } from "./routes/amtrak/borealis";
import { californiaZephyr } from "./routes/amtrak/california-zephyr";
import { southwestChief } from "./routes/amtrak/southwest-chief";
import { texasEagle } from "./routes/amtrak/texas-eagle";
import { sunsetLimited } from "./routes/amtrak/sunset-limited";
import { cityOfNewOrleans } from "./routes/amtrak/city-of-new-orleans";
import { empireBuilder } from "./routes/amtrak/empire-builder";
import { coastStarlight } from "./routes/amtrak/coast-starlight";
import { pacificSurfliner } from "./routes/amtrak/pacific-surfliner";
import { goldRunner } from "./routes/amtrak/gold-runner";
import { capitolCorridor } from "./routes/amtrak/capitol-corridor";
import { cascades } from "./routes/amtrak/cascades";
import { heartlandFlyer } from "./routes/amtrak/heartland-flyer";
import { hudsonLine } from "./routes/metro-north/hudson-line";
import { harlemLine } from "./routes/metro-north/harlem-line";
import { newHavenLine } from "./routes/metro-north/new-haven-line";
import { newCanaanBranch } from "./routes/metro-north/new-canaan-branch";
import { danburyBranch } from "./routes/metro-north/danbury-branch";
import { waterburyBranch } from "./routes/metro-north/waterbury-branch";
import { portJervisLine } from "./routes/metro-north/port-jervis-line";
import { pascackValleyLine } from "./routes/metro-north/pascack-valley-line";
import { blueRoute } from "./routes/ucat/blue-route";
import { yellowRoute } from "./routes/ucat/yellow-route";
import { clRoute } from "./routes/ucat/cl-route";
import { euRoute } from "./routes/ucat/eu-route";
import { ksRoute } from "./routes/ucat/ks-route";
import { kplRoute } from "./routes/ucat/kpl-route";
import { uplRoute } from "./routes/ucat/upl-route";
import { portEwenLoop } from "./routes/ucat/port-ewen-loop";
import { xRoute } from "./routes/ucat/x-route";
import { zRoute } from "./routes/ucat/z-route";
import { dutchessRouteA } from "./routes/dutchess-county/route-a";
import { dutchessRouteB } from "./routes/dutchess-county/route-b";
import { dutchessRouteC } from "./routes/dutchess-county/route-c";
import { dutchessRouteD } from "./routes/dutchess-county/route-d";
import { dutchessRouteE } from "./routes/dutchess-county/route-e";
import { dutchessRouteF } from "./routes/dutchess-county/route-f";
import { dutchessRouteG } from "./routes/dutchess-county/route-g";

export const BUNDLED_ROUTES: LegacyRoute[] = [
  northeastRegional,
  acela,
  keystoneService,
  pennsylvanian,
  vermonter,
  ethanAllenExpress,
  adirondack,
  empireService,
  mapleLeaf,
  downeaster,
  cardinal,
  crescent,
  silverStar,
  silverMeteor,
  palmetto,
  carolinian,
  piedmont,
  autoTrain,
  lakeShoreLimited,
  wolverine,
  blueWater,
  illiniSaluki,
  pereMarquette,
  lincolnService,
  missouriRiverRunner,
  hiawatha,
  borealis,
  californiaZephyr,
  southwestChief,
  texasEagle,
  sunsetLimited,
  cityOfNewOrleans,
  empireBuilder,
  coastStarlight,
  pacificSurfliner,
  goldRunner,
  capitolCorridor,
  cascades,
  heartlandFlyer,
  hudsonLine,
  harlemLine,
  newHavenLine,
  newCanaanBranch,
  danburyBranch,
  waterburyBranch,
  portJervisLine,
  pascackValleyLine,
  blueRoute,
  yellowRoute,
  clRoute,
  euRoute,
  ksRoute,
  kplRoute,
  uplRoute,
  portEwenLoop,
  xRoute,
  zRoute,
  dutchessRouteA,
  dutchessRouteB,
  dutchessRouteC,
  dutchessRouteD,
  dutchessRouteE,
  dutchessRouteF,
  dutchessRouteG,
];

/**
 * The catalog the editor falls back to when a host injects nothing — the same
 * routes that shipped before presets became injectable, so a bare embed is
 * unchanged. Authored in the flat legacy shape and lifted to the normalized v2
 * catalog at assembly time. Hosts that expect frequent changes should serve
 * their own catalog (see `createRemotePresetLoader`) instead of relying on this.
 */
export const BUNDLED_ROUTE_CATALOG: RouteCatalog = upgradeLegacyCatalog({
  groups: BUNDLED_NETWORKS,
  routes: BUNDLED_ROUTES,
});

export * from "./types";
export * from "./groups";
export * from "./groupLines";
export * from "./catalog";
export * from "./legacy";
