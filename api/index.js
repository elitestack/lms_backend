import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { google } from 'googleapis';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(helmet());
app.use(cookieParser());


const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://procoin.vercel.app',
  'http://192.168.32.20:3000'
];


const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['X-User-Email']
};

app.use(cors(corsOptions));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ MongoDB connected successfully 🚀'))
.catch(err => console.error('❌ MongoDB connection error:', err));


// User Schema (extended with role)
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' }, // NEW
  createdAt: { type: Date, default: Date.now },
  refreshTokens: [String]
});

const CourseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  lessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
  assignments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // admin
});

const LessonSchema = new mongoose.Schema({
  title: { type: String, required: true },
  youtubeLink: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }
});

const AssignmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  link: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' }
});

// Models
const User = mongoose.model('UserAdmin', UserSchema);
const Course = mongoose.model('Course', CourseSchema);
const Lesson = mongoose.model('Lesson', LessonSchema);
const Assignment = mongoose.model('Assignment', AssignmentSchema);


async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const userEmail = req.headers['email'];
    const userRole = req.headers['role'];
    
    if (!token) {
      return res.status(401).json({ 
        message: 'Authorization token required',
        code: 'TOKEN_MISSING'
      });
    }
    
    if (!userEmail) {
      return res.status(401).json({ 
        message: 'User email required',
        code: 'EMAIL_MISSING'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ 
      _id: decoded.userId, 
      email: userEmail 
    }).select('+refreshTokens');

    if (!user) {
      return res.status(403).json({ 
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (!user.refreshTokens.some(t => {
      try {
        const rt = jwt.verify(t, process.env.JWT_REFRESH_SECRET);
        return rt.userId === decoded.userId;
      } catch {
        return false;
      }
    })) {
      return res.status(403).json({ 
        message: 'Token invalidated',
        code: 'TOKEN_INVALIDATED'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    res.status(500).json({ 
      message: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
}


app.use(express.json());


// app.post('/api/logout', authenticateToken, async (req, res) => {

// REGISTER
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // check if this is the first user
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'student';

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role
    });

    await newUser.save();

    // create tokens
    const token = jwt.sign(
      { userId: newUser._id, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    newUser.refreshTokens.push(refreshToken);
    await newUser.save();

    res.status(201).json({
      message: 'User registered successfully',
      role: newUser.role,
      token,
      refreshToken,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});





// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    user.refreshTokens.push(refreshToken);
    await user.save();

    res.json({
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});






// Create Course (Admin only)
app.post('/api/courses', authenticateToken, async (req, res) => {
  if (req.headers['role'] !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  try {
    const { name, code } = req.body;
    const course = new Course({ name, code, createdBy: req.user._id });
    await course.save();
    res.status(201).json(course);
  } catch (error) {
    res.status(500).json({ message: 'Error creating course', error: error.message });
  }
});

// Read All Courses
app.get('/api/courses', async (req, res) => {
  const courses = await Course.find().populate('lessons assignments');
  res.json(courses);
});

// Read One Course
app.get('/api/courses/:id', async (req, res) => {
  const course = await Course.findById(req.params.id).populate('lessons assignments');
  if (!course) return res.status(404).json({ message: 'Course not found' });
  res.json(course);
});

// Update Course (Admin only)
app.put('/api/courses/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(course);
});

// Delete Course (Admin only)
app.delete('/api/courses/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  await Course.findByIdAndDelete(req.params.id);
  res.json({ message: 'Course deleted' });
});



// Create Lesson (Admin only)
app.post('/api/courses/:courseId/lessons', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { title, youtubeLink } = req.body;
  const lesson = new Lesson({ title, youtubeLink, course: req.params.courseId });
  await lesson.save();
  await Course.findByIdAndUpdate(req.params.courseId, { $push: { lessons: lesson._id } });
  res.status(201).json(lesson);
});

// Update Lesson
app.put('/api/lessons/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const lesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(lesson);
});

// Delete Lesson
app.delete('/api/lessons/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  await Lesson.findByIdAndDelete(req.params.id);
  res.json({ message: 'Lesson deleted' });
});



// Create Assignment (Admin only)
app.post('/api/courses/:courseId/assignments', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const { title, link } = req.body;
  const assignment = new Assignment({ title, link, course: req.params.courseId });
  await assignment.save();
  await Course.findByIdAndUpdate(req.params.courseId, { $push: { assignments: assignment._id } });
  res.status(201).json(assignment);
});

// Update Assignment
app.put('/api/assignments/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const assignment = await Assignment.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(assignment);
});

// Delete Assignment
app.delete('/api/assignments/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  await Assignment.findByIdAndDelete(req.params.id);
  res.json({ message: 'Assignment deleted' });
});




// const PORT = process.env.PORT || 4000;

// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });

export default app;
