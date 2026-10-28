import type {JurisdictionDefinition,AgendaSource} from "../types";
import type {AgendaAdapter} from "./types";
import {SourceHttp} from "../http";
import {escribeAdapter} from "./escribe";
import {iqm2Adapter} from "./iqm2";
import {adaFileBrowseAdapter} from "./ada-file-browse";
import {primegovAdapter} from "./primegov";
import {legacyAdapters,legacyFeed} from "./legacy";
import {archiveAdapter} from "./archives";
export function agendaAdapter(config:JurisdictionDefinition,source:AgendaSource,http:SourceHttp):AgendaAdapter {
 switch(source.adapter){case"escribe":return escribeAdapter(config,source,http);case"iqm2":return iqm2Adapter(config,source,http);case"adaFileBrowse":return adaFileBrowseAdapter(config,source,http);case"primegov":return config.legacyPublic?legacyAdapters(config,()=>legacyFeed(config)).agenda:primegovAdapter(config,source,http);default:if(config.legacyPublic)return legacyAdapters(config,()=>legacyFeed(config)).agenda;return archiveAdapter(config,source,http);}
}
