import { configureStore } from "@reduxjs/toolkit";
import { translatorSlice } from "./translatorSlice";

export const store = configureStore({
  reducer: {
    translator: translatorSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
