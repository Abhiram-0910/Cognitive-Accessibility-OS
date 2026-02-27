//import necessary modules and componenets from react,
//The useState hook lets you add state variables to your functional components. Before hooks, only class components could have state, but useState allows us to manage state in functional components too.
//The useEffect hook lets you run side effects in your components, such as data fetching, subscriptions, or manual DOM manipulations.
import React, { useState, useEffect } from 'react';
import axios from 'axios';//for https requests
import { Link, useNavigate ,useLocation} from 'react-router-dom';//we useNavigate for programmatic navigation.
import '../styles/Analysis.css';
import Navbar from './Logout_bar';

// Update the formatDateTime function
const formatDateTime = (timestamp) => {
  try {
    if (!timestamp || !Array.isArray(timestamp) || timestamp.length !== 2) {
      console.log('Invalid timestamp:', timestamp);
      return { date: 'N/A', time: 'N/A' };
    }

    // Parse the date and time strings
    const [dateStr, timeStr] = timestamp;

    // Create a new date object from the date string
    const date = new Date(dateStr);
    
    // Format the date in a more readable way
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    // Format the time (assuming it's already in a good format from toLocaleTimeString)
    const formattedTime = timeStr;

    return {
      date: formattedDate || 'N/A',
      time: formattedTime || 'N/A'
    };
  } catch (error) {
    console.error('Error formatting date/time:', error);
    return { date: 'N/A', time: 'N/A' };
  }
};

const Analysis = () => {
  // Define state variables for handling session data, analysis status, loading states, and navigation.
  const [sessions, setSessions] = useState([]);// Stores fetched session data.
  const [existingAnalysis, setExistingAnalysis] = useState({});// Tracks which sessions have existing analysis.
  const [isLoading, setIsLoading] = useState(true);// Indicates whether the session data is being loaded.
  const [loadingSessionId, setLoadingSessionId] = useState(null);// Tracks which session is currently being analyzed.
  const [searchTerm, setSearchTerm] = useState(''); // State for search term
  const navigate = useNavigate();// Enables navigation to other routes.
  
  // Function to fetch session data from the backend.
  const fetchSessions = async () => {
    try {
      console.log("Fetching sessions...");
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/admin/sessions`);
      console.log("Response from server:", response.data);
      
      if (!response.data || response.data.length === 0) {
        console.log("No sessions found");
        setSessions([]);
        return;
      }

      // Sort sessions by timestamp in descending order
      const sortedSessions = response.data.sort((a, b) => {
        const dateA = new Date(a.timestamp[0]); // Assuming timestamp is an array
        const dateB = new Date(b.timestamp[0]);
        return dateA - dateB; // Sort in ascending order (older sessions first)
      }).reverse(); // Reverse to make it descending (most recent sessions first)

    

      setSessions(sortedSessions);
    } catch (error) {
      console.error('Error fetching session data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // useEffect hook to fetch session data once on component mount.
  useEffect(() => {
    fetchSessions();// Call fetchSessions function on mount 
  }, []);
  // Function to handle clicks on a session for analysis.
  const handleSessionClick = async (sessionId) => {
    setLoadingSessionId(sessionId);//this will set the null to the specified sessionid
    try {
      console.log(`Requesting analysis for session ID: ${sessionId}`);
      console.log(2);
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/admin/sessions/analysis/${sessionId}`);

      //we are giving an api call to backend to this function over there
      //then we will get back from there either 404 or 200 or 500
      // if it gives 200 it is saying that for thgat particular session id the it will print thet alreday anaylsis is pt=resent
      if (response.status === 200 && response.data && response.data.analysisResults) {
        console.log("Analysis already exists:", response.data.analysisResults);
        setExistingAnalysis((prevState) => ({//
          ...prevState,
          [sessionId]: true,
        }));
      } else {
        // If no analysis exists, mark session for new analysis.
        setExistingAnalysis((prevState) => ({
          ...prevState,
          [sessionId]: false,
        }));
      }
    } catch (error) {
      // If no existing analysis is found (404), fetch media data and send for new analysis.
      if (error.response && error.response.status === 404) {
        console.log("No analysis found. Sending images to Hugging Face model...");
        try {
          console.log(3);
          
           // Send the images for analysis via POST request.
           const analysisResponse = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/admin/sessions/analyze/${sessionId}`);

          if (analysisResponse.data && analysisResponse.data.analysisResults) {
            const analysisResults = analysisResponse.data.analysisResults;
            


            // Optionally, save analysis results to the backend (code currently commented out).
            // await axios.post(`http://localhost:5000/sessions/${sessionId}/save-analysis`, { analysisResults });

            setExistingAnalysis((prevState) => ({
              ...prevState,
              [sessionId]: true, // Update state to indicate analysis exists.
            }));
            navigate(`/analysis`);// Navigate to the analysis page.
          } else {
            console.error("Analysis response did not contain results:", analysisResponse.data);
          }
        } catch (error) {
          console.error("Error during analysis process:", error.response ? error.response.data : error.message);
        }
      } else {
        console.error('Error during analysis request:', error.response ? error.response.data : error.message);
      }
    } finally {
      setLoadingSessionId(null); // Reset loading state after processing
    }
  };

  const handleHomeClick = () => {
    navigate('/'); // Navigates to the home page
  };
  
  
  const location = useLocation();
  const username = localStorage.getItem("username");
  const userNameOnly = username ? username.split('@')[0] : "User"; 
  console.log("Username : "+username);
  const userNameWithoutNumbers = userNameOnly.replace(/[0-9]/g, '');
  const handleLogout = () => {
    console.log(`${username} logged out.`);
    localStorage.removeItem("username");
    navigate('/',{state:{username}}); // Redirect to the home or login page
  };

  // Filter sessions based on the search term
  // const filteredSessions = sessions.filter(session =>
  //   session.sessionName.toLowerCase().includes(searchTerm.toLowerCase())
  // );
  const filteredSessions = sessions.filter(session =>
    session.sessionName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    session.gameName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      
        {/* Top Navbar */}
        
        <Navbar username={userNameWithoutNumbers} handleLogout={handleLogout} role="admin" />

    <div className="scrollable-table-container">
      <h1 className="text-center">
        SESSIONS
        {isLoading && (//here first it will check whetherthe is loading true or false if it is true it will enter into the part and here it will show the ar glass 
          <span role="img" aria-label="loading" style={{ marginLeft: '10px' }}>
            ⌛
          </span>
        )}
      </h1>

      {/* Search Bar */}
      <div className="mb-3">
      <input
            type="text"
            className="form-control"
            placeholder="Search by Player Name or Game Name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} // Update search term on input change
          />
      </div>

      {!isLoading && (//if isloading is falsetheen it will enter into it here it will stop showing the ar glass and it will display the table
        <table className="table table-striped">
          <thead>
            <tr>
              <th>Name</th>
              <th>Game</th>
              <th>Date</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSessions.map((session, index) => {
              // Use the new formatDateTime function
              const { date, time } = formatDateTime(session.timestamp);
              
              return (
                <tr key={session.sessionId || index}>
                  <td>{session.sessionName}</td>
                  <td>{session.gameName || 'N/A'}</td>
                  <td>{date}</td>
                  <td>{time}</td>
                  <td>
                    <button 
                      className="analyze-button" 
                      onClick={() => handleSessionClick(session.sessionId)} 
                      disabled={loadingSessionId === session.sessionId}
                    >
                      Analyze
                      {loadingSessionId === session.sessionId && (
                        <span className="spinner-border spinner-border-sm loading-spinner" role="status" aria-hidden="true"></span>
                      )}
                    </button>
                    
                    {existingAnalysis[session.sessionId] && (
                      <div>
                        <Link to={`/analysis/${session.sessionId}`} className="overall-analysis-button" style={{ marginRight: '10px' }} state={{ username }}>
                          Overall Analysis
                        </Link><br />
                        <Link to={`/DetailedAnalysis/${session.sessionId}`} className="detailed-analysis-button" state={{ username }}>
                          Detailed Analysis
                        </Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      
    </div>

    </div>
    
  );
};

export default Analysis;
