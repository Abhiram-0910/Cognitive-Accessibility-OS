import "./App.css";
import React,{ useState} from 'react';
import { BrowserRouter, Route, Routes, useLocation ,Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

// Import your components
import ProtectedRoute from "./components/ProtectedRoute";
import Analysis from './components/Analysis'; 
import OverallAnalysis from './components/OverallAnalysis';
import DetailedAnalysis from './components/DetailedAnalysis';
import Game from './components/Game';
import GameSelection from './components/GameSelection';
import Game_2 from './components/game_2';
import Login1 from "./components/Login1";
import ManageChildAccounts from "./components/ManageChildAccounts";
import Register from "./components/Register";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import PendingRequests from "./components/PendingRequests";
import Unauthorized from "./components/AccessDenied";
import UpdatePassword from "./components/UpdatePassword";
const Main = () => {
  const location = useLocation();

  let backgroundClass = 'no-background'; // Default background class

  if (location.pathname === '/') {
    backgroundClass = 'login-background'; // Home page background
  } //else if (location.pathname === '/game') {
    //backgroundClass = 'full-background'; } // Game page background
    else if(location.pathname==='/login')
  {
    backgroundClass = 'login-background';
  }
  else if(location.pathname==='/game')
    {
      backgroundClass = 'game-background';
    }
  else if(location.pathname==='/select-game')
    {
      backgroundClass = 'full-background';
    }
  else if (location.pathname === '/analysis' || location.pathname.startsWith('/analysis/')) {
    backgroundClass = 'analysis-background'; // Analysis page background
  }
  else if (location.pathname.startsWith('/DetailedAnalysis/')) {
    backgroundClass = 'analysis-background'; // Analysis page background
  }
  return (
    <div className={backgroundClass}>
      <div className="content">
        <Routes>
          <Route path="/" element={<Login1/>} />
          <Route path="/select-game" element={<GameSelection />} />
          <Route path="/game" element={<Game />} />
          <Route path="/game_2" element={<Game_2 />} />
          <Route path="/analysis" element={<ProtectedRoute allowedRoles={['super_admin','admin']}><Analysis /></ProtectedRoute>} />
          <Route path="/analysis/:sessionId" element={<ProtectedRoute allowedRoles={['super_admin','admin']}><OverallAnalysis /></ProtectedRoute>} />
          <Route path="/DetailedAnalysis/:sessionId" element={<ProtectedRoute allowedRoles={['super_admin','admin']}><DetailedAnalysis /></ProtectedRoute>} />
          <Route path="/analysis/manage-accounts" element={<ProtectedRoute allowedRoles={['super_admin','admin']}><ManageChildAccounts /></ProtectedRoute>} />
          <Route path="/adminlogin" element={<Login1 />} /> 
          <Route path="/adminRegistration" element={<Register />} /> 
          <Route path="/super-admin-dashboard" element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminDashboard/></ProtectedRoute>}/>
          <Route path="/pending-requests" element={<ProtectedRoute allowedRoles={["super_admin"]}><PendingRequests/></ProtectedRoute>}/>
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/analysis/update-password" element={<UpdatePassword />} />
        </Routes>
      </div>
    </div>
  );
}
function App() {
  return (
    <BrowserRouter>
      <Main />
    </BrowserRouter>
  );
}

export default App;
