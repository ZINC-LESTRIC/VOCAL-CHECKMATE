// Centralized data-testid map for the chess app.
export const HOME = { emergentLink: "home-emergent-link" };

export const AUTH = {
  loginEmail: "login-email-input",
  loginPassword: "login-password-input",
  loginSubmit: "login-submit-btn",
  registerEmail: "register-email-input",
  registerUsername: "register-username-input",
  registerPassword: "register-password-input",
  registerSubmit: "register-submit-btn",
  logoutBtn: "logout-btn",
  authError: "auth-error",
};

export const NAV = {
  brand: "nav-brand",
  dashboard: "nav-dashboard",
  playAi: "nav-play-ai",
  playLocal: "nav-play-local",
  playOnline: "nav-play-online",
  friends: "nav-friends",
  profile: "nav-profile",
  settings: "nav-settings",
  admin: "nav-admin",
};

export const PLAY = {
  levelCard: (n) => `engine-level-${n}-card`,
  startEngine: "engine-start-btn",
  resign: "game-resign-btn",
  newGame: "game-new-btn",
  voiceMic: "voice-mic-btn",
  voiceTranscript: "voice-transcript",
  boardSquare: (sq) => `board-square-${sq}`,
  moveList: "move-list",
  flipBoard: "flip-board-btn",
};

export const ONLINE = {
  queueJoin: "online-queue-join",
  queueLeave: "online-queue-leave",
  inviteCreate: "online-invite-create",
  inviteCode: "online-invite-code",
  inviteAccept: "online-invite-accept",
  inviteInput: "online-invite-input",
  chatInput: "online-chat-input",
  chatSend: "online-chat-send",
};

export const PROFILE = {
  username: "profile-username-input",
  name: "profile-name-input",
  bio: "profile-bio-input",
  country: "profile-country-input",
  avatar: "profile-avatar-input",
  save: "profile-save-btn",
};

export const ADMIN = {
  search: "admin-search-input",
  ban: (id) => `admin-ban-${id}`,
  unban: (id) => `admin-unban-${id}`,
  del: (id) => `admin-delete-${id}`,
};

export const FRIENDS = {
  addInput: "friends-add-input",
  addBtn: "friends-add-btn",
  accept: (id) => `friend-accept-${id}`,
  decline: (id) => `friend-decline-${id}`,
  remove: (id) => `friend-remove-${id}`,
  item: (id) => `friend-item-${id}`,
};

export const REVIEW = {
  first: "review-first-btn",
  prev: "review-prev-btn",
  next: "review-next-btn",
  last: "review-last-btn",
  evalBar: "eval-bar",
  pgn: "review-pgn",
  moveBtn: (i) => `review-move-${i}`,
};
