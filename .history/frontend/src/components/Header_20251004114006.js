import React from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Search, FileText } from "lucide-react";
import "./Header.css";

const Header = () => {
  const location = useLocation();
  
  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <BookOpen size={24} />
          <span className="logo-text">
            <span className="blue-text">Research</span>AI
          </span>
        </Link>
        
        <nav className="nav">
          <Link 
            to="/" 
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            <Search size={18} />
            Search
          </Link>
          <Link 
            to="/research" 
            className={`nav-link ${location.pathname === '/research' ? 'active' : ''}`}
          >
            <FileText size={18} />
            Papers
          </Link>
        </nav>
        
      
      </div>
    </header>
  );
};

export default Header;

// import React from "react";
// import "./Header.css";

// const Header = () => (
//   <header className="header">
//     <div className="logo">
//       📖 <span className="blue-text">Research</span>AI
//     </div>
//     <div className="auth-buttons">
//       <button className="sign-in">Sign In</button>
//       <button className="get-started">Get Started</button>
//     </div>
//   </header>
// );

// export default Header;
