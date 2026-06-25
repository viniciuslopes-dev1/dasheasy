export const LOCAL_TEST_USER_ID = 'local-test-admin';
export const LOCAL_TEST_USER_NAME = 'Admin Local';

export const isLocalTestMode =
  import.meta.env.DEV && import.meta.env.VITE_LOCAL_TEST_MODE === 'true';

