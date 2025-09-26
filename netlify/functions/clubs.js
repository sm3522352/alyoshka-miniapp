const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const STORAGE_PATH = path.join(__dirname, '..', '..', 'data', 'clubs_state.json');

function readStore() {
  if (!fs.existsSync(STORAGE_PATH)) {
    return { clubs: [], posts: {} };
  }
  try {
    const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return {
      clubs: Array.isArray(data.clubs) ? data.clubs : [],
      posts: typeof data.posts === 'object' && data.posts ? data.posts : {},
    };
  } catch (err) {
    console.error('Failed to read clubs store', err);
    return { clubs: [], posts: {} };
  }
}

function writeStore(data) {
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write clubs store', err);
  }
}

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (err) {
    return {};
  }
}

function ensureMember(data, clubId, userId) {
  if (!userId) return;
  const club = data.clubs.find((item) => item.id === clubId);
  if (!club) return;
  club.members = Array.from(new Set([...(club.members || []), userId]));
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  const basePath = '/.netlify/functions/clubs';
  const extra = event.path?.startsWith(basePath) ? event.path.slice(basePath.length) : '';
  const segments = extra.split('/').filter(Boolean);
  const userId = event.headers['x-user-id'] || 'demo-user';
  const store = readStore();

  if (method === 'GET' && segments.length === 0) {
    const payload = store.clubs.filter((club) => !club.members || club.members.includes(userId));
    return jsonResponse(200, { clubs: payload });
  }

  if (method === 'GET' && segments.length === 2 && segments[1] === 'posts') {
    const clubId = segments[0];
    const posts = store.posts?.[clubId] || [];
    return jsonResponse(200, { posts });
  }

  if (method === 'POST' && segments.length === 0) {
    const body = parseBody(event);
    if (!body?.name) {
      return jsonResponse(400, { error: 'Название обязательно' });
    }
    const club = {
      id: `club-${uuidv4()}`,
      name: body.name,
      description: body.description || '',
      owner_id: userId,
      members: [userId],
      cover: body.cover || '',
      created_at: new Date().toISOString(),
    };
    store.clubs.push(club);
    writeStore(store);
    return jsonResponse(201, { club });
  }

  if (method === 'POST' && segments.length === 2 && segments[1] === 'post') {
    const clubId = segments[0];
    const body = parseBody(event);
    if (!body?.text) {
      return jsonResponse(400, { error: 'Текст обязателен' });
    }
    const post = {
      id: `post-${uuidv4()}`,
      author: userId,
      text: body.text,
      imageUrl: body.imageUrl || '',
      reactions: { heart: 0, like: 0, sprout: 0 },
      created_at: new Date().toISOString(),
    };
    if (!store.posts[clubId]) {
      store.posts[clubId] = [];
    }
    store.posts[clubId].unshift(post);
    ensureMember(store, clubId, userId);
    writeStore(store);
    return jsonResponse(201, { post });
  }

  if (method === 'POST' && segments.length === 3 && segments[1] === 'posts' && segments[2] === 'react') {
    const clubId = segments[0];
    const body = parseBody(event);
    const { postId, reaction } = body;
    if (!postId || !reaction) {
      return jsonResponse(400, { error: 'Нужно указать postId и reaction' });
    }
    const allowed = { heart: 'heart', like: 'like', sprout: 'sprout' };
    if (!allowed[reaction]) {
      return jsonResponse(400, { error: 'Неизвестная реакция' });
    }
    const posts = store.posts?.[clubId] || [];
    const target = posts.find((item) => item.id === postId);
    if (!target) {
      return jsonResponse(404, { error: 'Пост не найден' });
    }
    target.reactions = target.reactions || { heart: 0, like: 0, sprout: 0 };
    target.reactions[reaction] = (target.reactions[reaction] || 0) + 1;
    ensureMember(store, clubId, userId);
    writeStore(store);
    return jsonResponse(200, { post: target });
  }

  return jsonResponse(405, { error: 'Метод не поддерживается' });
};