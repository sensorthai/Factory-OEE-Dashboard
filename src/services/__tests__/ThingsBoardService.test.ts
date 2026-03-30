import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { ThingsBoardService } from '../ThingsBoardService';

vi.mock('axios');
const mockedAxios = axios as any;

describe('ThingsBoardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Authentication', () => {
    it('should login successfully and store tokens', async () => {
      const mockTokens = { token: 'test-token', refreshToken: 'test-refresh' };
      mockedAxios.post.mockResolvedValueOnce({ data: mockTokens });

      const credentials = { username: 'test@example.com', password: 'password' };
      const result = await ThingsBoardService.login(credentials);

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/auth/login', credentials);
      expect(result).toEqual(mockTokens);
      expect(localStorage.getItem('tb_token')).toBe('test-token');
      expect(localStorage.getItem('tb_refresh_token')).toBe('test-refresh');
    });

    it('should handle login failure', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(ThingsBoardService.login({})).rejects.toThrow('Invalid credentials');
    });

    it('should refresh token successfully', async () => {
      localStorage.setItem('tb_refresh_token', 'old-refresh');
      const newTokens = { token: 'new-token', refreshToken: 'new-refresh' };
      mockedAxios.post.mockResolvedValueOnce({ data: newTokens });

      const result = await ThingsBoardService.refreshAccessToken();

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/auth/refresh', { refreshToken: 'old-refresh' });
      expect(result).toBe('new-token');
      expect(localStorage.getItem('tb_token')).toBe('new-token');
    });

    it('should logout and clear storage', () => {
      localStorage.setItem('tb_token', 'token');
      localStorage.setItem('tb_refresh_token', 'refresh');

      ThingsBoardService.logout();

      expect(localStorage.getItem('tb_token')).toBeNull();
      expect(localStorage.getItem('tb_refresh_token')).toBeNull();
    });
  });

  describe('API Integration', () => {
    it('should fetch devices successfully', async () => {
      const mockDevices = [{ id: { id: '1' }, name: 'Device 1' }];
      // Mock the request method which is used by getDevices
      vi.spyOn(ThingsBoardService, 'request').mockResolvedValueOnce({ data: { data: mockDevices } } as any);

      const result = await ThingsBoardService.getDevices();

      expect(result).toEqual(mockDevices);
    });

    it('should handle 403 error in getDeviceProfiles with fallback', async () => {
      vi.spyOn(ThingsBoardService, 'request').mockRejectedValueOnce({
        response: { status: 403 }
      });

      const result = await ThingsBoardService.getDeviceProfiles();

      expect(result).toEqual({ data: [] });
    });
  });
});
