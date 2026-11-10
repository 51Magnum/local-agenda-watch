import { unstable_cache as nextCache } from "next/cache";
import { isReadOnly } from "./runtime-environment";

/** The standalone audit has no Next request cache; production behavior stays unchanged. */
export const readCache: typeof nextCache = (callback, keyParts, options) => {
  const cached=nextCache(callback,keyParts,options);
  return ((...args:Parameters<typeof callback>)=>isReadOnly()?callback(...args):cached(...args)) as typeof callback;
};
