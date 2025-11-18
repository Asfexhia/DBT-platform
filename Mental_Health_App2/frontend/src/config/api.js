// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: `${API_BASE_URL}/login`,
  SIGNUP: `${API_BASE_URL}/signup`,
  
  // User endpoints
  USERS: `${API_BASE_URL}/users`,
  USER_DETAILS: (username) => `${API_BASE_URL}/${username}/getuserdetails`,
  UPDATE_USER: (username) => `${API_BASE_URL}/${username}/update-user`,
  DELETE_USER: (username) => `${API_BASE_URL}/delete-user/${username}`,
  
  // Journal endpoints
  CREATE_JOURNAL: (username) => `${API_BASE_URL}/${username}`,
  GET_JOURNALS: (username) => `${API_BASE_URL}/${username}/journals`,
  GET_JOURNAL_BY_ID: (username, id) => `${API_BASE_URL}/${username}/${id}`,
  UPDATE_JOURNAL: (username, id) => `${API_BASE_URL}/journals/${username}/${id}`,
  DELETE_JOURNAL: (username, id) => `${API_BASE_URL}/journal-delete/${username}/${id}`,
  
  // Mood endpoints
  GET_MOODS: (username) => `${API_BASE_URL}/api/moods/${username}`,
  CREATE_MOOD: (username) => `${API_BASE_URL}/api/moods/${username}`,
  
  // Anonymous posts endpoints
  GET_ANONYMOUS_POSTS: `${API_BASE_URL}/anonymousPosts`,
  CREATE_ANONYMOUS_POST: `${API_BASE_URL}/createAnonymousPosts`,
};

export default API_BASE_URL;