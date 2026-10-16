import { storeToRefs } from "pinia";
import { useLocalLibraryStore } from "../stores/local-library";

export function useLocalLibrary() {
  const store = useLocalLibraryStore(usePinia());
  return {
    ...storeToRefs(store),
    refresh: store.refresh,
    remove: store.remove,
    toggleCompleted: store.toggleCompleted,
  };
}
