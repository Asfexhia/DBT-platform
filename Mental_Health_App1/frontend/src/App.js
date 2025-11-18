import React, { useEffect, useRef, useState } from 'react';
import {BrowserRouter, Routes, Route, Navigate, useParams, useLocation} from 'react-router-dom';
import Home from './compnents/home/Home';
import Profile from './compnents/profile/Profile';
import NotFound from './compnents/notFound/NotFound';
import Signup from './compnents/SignupIn/Signup';
import Login from './compnents/login/Login';
import NoAccess from './compnents/noAccess/NoAccess';
import ProfileUpdate from './compnents/profile/ProfileUpdate';
import AnonymousSharing from './compnents/anonymous/AnonymousSharing';
import AnonymousPost from './compnents/anonymous/AnonymousPost';
import AllAnonymousPost from './compnents/anonymous/AllAnonymousPost';
import AboutUs from './compnents/aboutUs/AboutUs';
import Createjournal from './compnents/journal/Createjournal.jsx';
import Readjournal from './compnents/journal/Readjournal.jsx';
import JournalDetail from './compnents/journal/Readonejournal.jsx';
import MoodTrack from './compnents/moodtrack/MoodTrack.jsx';
import FloatingMoodButton from './compnents/moodtrack/FloatingMoodButton.jsx';
import Achievements from './compnents/achievements/Achievements.jsx';
import UpdateJournal from './compnents/journal/Updatejournal.jsx';
import Therapist from './compnents/AITherapist/Therapist.jsx';
import TestTherapist from './compnents/AITherapist/TestTherapist.jsx';
import TestAccessRoute from './components/TestAccessRoute.jsx';

const PrivateRoute = ({ children }) => {
  const { username: usernameFromUrl } = useParams(); // Extract username from URL
  const token = localStorage.getItem('token');
  const usernameFromStorage = localStorage.getItem('tokenUser');

  if (!token || usernameFromUrl !== usernameFromStorage) {
    localStorage.removeItem('token');
    localStorage.removeItem('tokenUser');
    return <Navigate to="/unauthorizedAccess" />;
  }

  return children;
};

function AppRoutes() {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    const prev = prevPathRef.current;
    const needs = sessionStorage.getItem('needsMoodPrompt');
    if (needs === '1') {
      const fromTherapist = prev.includes('/therapist') || prev.includes('/test-therapist');
      const toDifferent = location.pathname !== prev;
      if (fromTherapist && toDifferent) {
        setShowExitModal(true);
      }
    }
    prevPathRef.current = location.pathname;
  }, [location]);

  const handleRecordNow = () => {
    try { window.dispatchEvent(new Event('openFloatingMoodModal')); } catch (e) {}
    setShowExitModal(false);
    try { sessionStorage.removeItem('needsMoodPrompt'); } catch (e) {}
  };

  const handleDismiss = () => {
    setShowExitModal(false);
    try { sessionStorage.removeItem('needsMoodPrompt'); } catch (e) {}
  };

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/:username/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorizedAccess" element={<NoAccess />} />
        <Route path="/:username/updateprofile" element={<PrivateRoute><ProfileUpdate /></PrivateRoute>} />
        <Route path="/:username/anonymoussharing" element={<PrivateRoute><AnonymousSharing /></PrivateRoute>} />
        <Route path="/:username/createanonymouspost" element={<PrivateRoute><AnonymousPost /></PrivateRoute>} />
        <Route path="/:username/allanonymousposts" element={<PrivateRoute><AllAnonymousPost /></PrivateRoute>} />
        <Route path="/:username/mood" element={<PrivateRoute><MoodTrack /></PrivateRoute>} />
        <Route path="/:username/achievements" element={<PrivateRoute><Achievements /></PrivateRoute>} />
        <Route path="/:username/therapist" element={<PrivateRoute><Therapist /></PrivateRoute>} />
        <Route path="/:username/test-therapist" element={<PrivateRoute><TestAccessRoute><TestTherapist /></TestAccessRoute></PrivateRoute>} />
        <Route path="/aboutus" element={<AboutUs />} />

        <Route path='/:username/createjournal' element={<PrivateRoute><Createjournal /></PrivateRoute>} />
        <Route path='/:username/readjournals' element={<PrivateRoute><Readjournal /></PrivateRoute>} />
        <Route path='/:username/readjournals/:id' element={<PrivateRoute><JournalDetail /></PrivateRoute>} />
        <Route path="/:username/journals/:id/edit" element={<PrivateRoute><UpdateJournal /> </PrivateRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>

      <FloatingMoodButton />

      {/* Exit modal prompting to record mood after completing training/test */}
      {showExitModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'white', padding:20, borderRadius:12, minWidth:320, boxShadow:'0 20px 40px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginBottom:8, fontSize:18, fontWeight:600 }}>Thanks for completing your session</h3>
            <p style={{ marginBottom:12 }}>Thanks for finishing the training/test. Would you like to quickly record how you're feeling now?</p>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={handleDismiss} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #ddd' }}>Maybe later</button>
              <button onClick={handleRecordNow} style={{ padding:'8px 12px', borderRadius:8, background:'#06b6d4', color:'white', border:'none' }}>Record mood</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
