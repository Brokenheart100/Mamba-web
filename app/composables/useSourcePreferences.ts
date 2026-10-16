import { storeToRefs } from "pinia";
import { useSourcePreferencesStore } from "../stores/source-preferences";

export function useSourcePreferences() {
  const store = useSourcePreferencesStore(usePinia());
  return {
    ...storeToRefs(store),
    initialize: store.initialize,
    setEnabled: store.setEnabled,
    setDefaults: store.setDefaults,
  };
}
