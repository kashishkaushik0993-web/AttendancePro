// backend/server.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

const SECRET_KEY = 'attendancepro-university-secret-2026';
const fs = require('fs');
const DATA_FILE = './data.json';

let users = [];
let attendances = [];
let eventRequests = [];

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users, attendances, eventRequests }, null, 2));
}

if (fs.existsSync(DATA_FILE)) {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  users = data.users || [];
  attendances = data.attendances || [];
  eventRequests = data.eventRequests || [];
} else {
  // Store some default initial data
  users = [
    {
      id: 1,
      rollNo: '101',
      name: 'Kashish',
      password: bcrypt.hashSync('1234', 10),
      role: 'student'
    },
    {
      id: 2,
      rollNo: 'admin',
      name: 'Teacher',
      password: bcrypt.hashSync('1234', 10),
      role: 'teacher'
    },
    {
      id: 3,
      rollNo: '102',
      name: 'Rahul',
      password: bcrypt.hashSync('1234', 10),
      role: 'student'
    }
  ];
  attendances = [
    {
      id: 1,
      userId: 1,
      rollNo: '101',
      name: 'Kashish',
      date: new Date(Date.now() - 86400000).toLocaleDateString('en-IN'), // Yesterday
      time: '09:00:00 am',
      course: 'CSE-301',
      status: 'Present'
    }
  ];
  eventRequests = [];
  saveData();
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access denied. No token.' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// ==================== AUTH ROUTES ====================
app.post('/api/register', async (req, res) => {
  const { rollNo, name, password, role = 'student' } = req.body;
  if (users.find(u => u.rollNo === rollNo)) {
    return res.status(400).json({ message: 'User already exists' });
  }
  const hashed = await bcrypt.hash(password, 10);
  const newUser = { id: users.length + 1, rollNo, name, password: hashed, role };
  users.push(newUser);
  saveData();
  res.status(201).json({ message: 'Registration successful' });
});

app.post('/api/login', async (req, res) => {
  const { userId, password, role } = req.body;
  const user = users.find(u => u.rollNo === userId && u.role === role);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, rollNo: user.rollNo, name: user.name, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, rollNo: user.rollNo, name: user.name, role: user.role } });
});

// ==================== ATTENDANCE ROUTES ====================
app.post('/api/mark-attendance', authenticateToken, (req, res) => {
  const { latitude, longitude, course = 'CSE-301' } = req.body;
  const record = {
    id: attendances.length + 1,
    userId: req.user.id,
    rollNo: req.user.rollNo,
    name: req.user.name || 'Student',
    date: new Date().toLocaleDateString('en-IN'),
    time: new Date().toLocaleTimeString('en-IN'),
    course,
    latitude,
    longitude,
    status: 'Present',
    proximityVerified: true,
    faceVerified: true
  };
  attendances.push(record);
  saveData();
  res.json({ message: 'Attendance marked successfully', record });
});

app.get('/api/history', authenticateToken, (req, res) => {
  const userHistory = attendances.filter(a => a.userId === req.user.id);
  res.json(userHistory);
});

app.get('/api/all-attendance', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Teachers only' });
  res.json(attendances);
});

app.post('/api/event-request', authenticateToken, (req, res) => {
  const { eventName, proof } = req.body;
  const newReq = {
    id: Date.now(),
    studentId: req.user.id,
    roll: req.user.rollNo,
    name: req.user.name,
    event: eventName,
    proof: proof,
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    status: 'pending'
  };
  eventRequests.push(newReq);
  saveData();
  res.json({ message: 'Event request submitted successfully' });
});

app.get('/api/events', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Teachers only' });
  res.json({
    pending: eventRequests.filter(r => r.status === 'pending'),
    resolved: eventRequests.filter(r => r.status !== 'pending')
  });
});

app.post('/api/resolve-event', authenticateToken, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Teachers only' });
  const { id, action } = req.body;
  const request = eventRequests.find(r => r.id === id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  
  if (action === 'approve') {
    request.status = 'approved';
    request.resolution = 'Approved';
    request.time2 = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const record = {
      id: attendances.length + 1,
      userId: request.studentId,
      rollNo: request.roll,
      name: request.name,
      date: new Date().toLocaleDateString('en-IN'),
      time: request.time2,
      course: 'CSE-301',
      status: 'Present',
      event: request.event,
      proximityVerified: false,
      faceVerified: false
    };
    attendances.push(record);
  } else {
    request.status = 'rejected';
    request.resolution = 'Rejected';
    request.time2 = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  saveData();
  res.json({ message: `Event ${action}d` });
});

app.get('/', (req, res) => res.redirect('/login.html'));

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));