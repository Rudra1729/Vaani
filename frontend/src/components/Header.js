import React from "react";
import "./Header.css";

const Header = () => (
  <header className="header">
    <div className="logo">
      📖 <span className="blue-text">Research</span>AI
    </div>
    
    <div className="auth-buttons">
      <button className="sign-in">Sign In</button>
      <button className="get-started">Get Started</button>
    </div>
  </header>
);

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
