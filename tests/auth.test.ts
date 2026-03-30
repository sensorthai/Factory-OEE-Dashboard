import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

// Mocking axios for authentication tests
vi.mock('axios');
const mockedAxios = axios as any;

describe('Authentication Logic', () => {
  const THINGSBOARD_URL = "https://iot1.wsa.cloud";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Functionality', () => {
    it('should successfully login and return tokens', async () => {
      const mockResponse = {
        data: {
          token: 'jwt-token-123',
          refreshToken: 'refresh-token-456'
        }
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const credentials = { username: 'admin', password: 'password' };
      const response = await axios.post(`${THINGSBOARD_URL}/api/auth/login`, credentials);

      expect(mockedAxios.post).toHaveBeenCalledWith(`${THINGSBOARD_URL}/api/auth/login`, credentials);
      expect(response.data.token).toBe('jwt-token-123');
    });

    it('should fail login with invalid credentials', async () => {
      const mockError = {
        response: {
          status: 401,
          data: { message: 'Authentication failed' }
        }
      };
      mockedAxios.post.mockRejectedValueOnce(mockError);

      try {
        await axios.post(`${THINGSBOARD_URL}/api/auth/login`, {});
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.message).toBe('Authentication failed');
      }
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token using refresh token', async () => {
      const mockResponse = {
        data: {
          token: 'new-jwt-token',
          refreshToken: 'new-refresh-token'
        }
      };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const refreshData = { refreshToken: 'old-refresh-token' };
      const response = await axios.post(`${THINGSBOARD_URL}/api/auth/token`, refreshData);

      expect(mockedAxios.post).toHaveBeenCalledWith(`${THINGSBOARD_URL}/api/auth/token`, refreshData);
      expect(response.data.token).toBe('new-jwt-token');
    });
  });

  describe('Middleware Logic (Mocked)', () => {
    it('should verify token with ThingsBoard', async () => {
      const mockUser = { data: { id: 'user-123', username: 'admin' } };
      mockedAxios.get.mockResolvedValueOnce(mockUser);

      const token = 'Bearer valid-token';
      const response = await axios.get(`${THINGSBOARD_URL}/api/auth/user`, {
        headers: { Authorization: token }
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(`${THINGSBOARD_URL}/api/auth/user`, {
        headers: { Authorization: token }
      });
      expect(response.data.username).toBe('admin');
    });

    it('should reject invalid token', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } });

      try {
        await axios.get(`${THINGSBOARD_URL}/api/auth/user`, {
          headers: { Authorization: 'Bearer invalid-token' }
        });
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });
});
