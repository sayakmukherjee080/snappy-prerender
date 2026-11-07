/**
 * Creates a tiny Suspense-compatible resource cache with one stable promise per load cycle.
 * @param {() => Promise<unknown>} loader
 * @returns {{ load: () => Promise<unknown>, reset: () => void }}
 */
export function createResource(loader) {
  let promise = null;
  let error;

  return {
    load() {
      if (error) throw error;
      if (!promise) {
        promise = loader().catch((reason) => {
          error = reason;
          throw reason;
        });
      }
      return promise;
    },

    reset() {
      promise = null;
      error = undefined;
    },
  };
}
