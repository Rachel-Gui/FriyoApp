// Browser preview sessions are scoped to this tab; native builds use SecureStore.
export const tokenStorage = {
  async getItemAsync(key: string): Promise<string | null> {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(key);
  },
  async setItemAsync(key: string, value: string): Promise<void> {
    if (typeof sessionStorage === 'undefined') throw new Error('Sign-in storage is unavailable.');
    sessionStorage.setItem(key, value);
  },
  async deleteItemAsync(key: string): Promise<void> {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
  },
};
