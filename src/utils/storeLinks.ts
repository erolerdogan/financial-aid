// Links to the app's own store page, for Settings → About (Rate the App, Write a Review).
// Pure: the platform is passed in, so the tsx tests do not load react-native.

export interface StoreIds {
  /** Numeric Apple ID from App Store Connect (App Information), without the "id" prefix. */
  appStoreId: string | null;
  /** Android application ID (`android.package` in app.json). */
  androidPackage: string | null;
}

// TODO(release): fill in once the app record exists in App Store Connect. While it is null the
// two rows are hidden on iOS.
export const STORE_IDS: StoreIds = {
  appStoreId: null,
  androidPackage: 'com.financialaid.app',
};

export interface StoreLinks {
  /** The store page, where the stars are. */
  rate: string;
  /** The same page, opened on its reviews: the review sheet on iOS, the review list on Android. */
  review: string;
}

/** Null when the platform has no store or its ID is not known yet; the rows are then not shown. */
export const getStoreLinks = (os: string, ids: StoreIds = STORE_IDS): StoreLinks | null => {
  if (os === 'ios') {
    const id = ids.appStoreId?.trim().replace(/^id/i, '');
    if (!id || !/^\d+$/.test(id)) return null;
    const page = `https://apps.apple.com/app/id${id}`;
    return { rate: page, review: `${page}?action=write-review` };
  }
  if (os === 'android') {
    const appId = ids.androidPackage?.trim();
    if (!appId) return null;
    const page = `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}`;
    return { rate: page, review: `${page}&showAllReviews=true` };
  }
  return null;
};
