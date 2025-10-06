import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, FileText, Calendar, User, Loader2 } from "lucide-react";
import "./ResearchPapers.css";
import { useLanguage } from "../lang/LanguageContext";

const ResearchPapers = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    const storedResults = localStorage.getItem("searchResult");
    const storedQuery = localStorage.getItem("lastSearchTerm");
    if (storedResults) {
      setResults(JSON.parse(storedResults));
      if (storedQuery) {
        // Ensure plain string, strip brackets/quotes if accidentally stored
        const clean = String(storedQuery).replace(/^\[object Object\]$/i, '').replace(/^"|"$/g, '');
        setQuery(clean);
      }
    } else {
      navigate("/");
    }
  }, [navigate]);

  const handlePaperClick = async (paper) => {
    setLoading(true);
    setError("");

    try {
      // Step 1: Log the click
      await fetch("https://vani-backend-311709302102.europe-west1.run.app/log-click", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paper),
      });

      // Step 2: Update PDF and reload model
      const updateResponse = await fetch("https://vani-backend-311709302102.europe-west1.run.app/update-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ link: paper.url }),
      });

      if (!updateResponse.ok) {
        throw new Error("Failed to update PDF");
      }

      // Step 3: Navigate to PDF viewer
      navigate("/pdf-viewer");
    } catch (error) {
      console.error("Error during click or PDF update:", error);
      setError(t('papers.error'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const truncateText = (text, maxLength) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  return (
    <div className="research-container">
      <div className="research-header">
        <h1>{t('papers.header')}</h1>
        <p>{t('papers.found', { count: results.length })}</p>
      </div>

      {loading && (
        <div className="loading-overlay">
          <Loader2 className="loading-spinner" size={32} />
          <p>{t('papers.loading')}</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {results.length > 0 ? (
        <div className="papers-grid">
          {results.map((paper, index) => (
            <div key={index} className="paper-card">
              <div className="paper-header">
                <FileText className="paper-icon" size={20} />
                <div className="paper-meta">
                  {paper.published && (
                    <div className="paper-date">
                      <Calendar size={14} />
                      {formatDate(paper.published)}
                    </div>
                  )}
                  {paper.authors && (
                    <div className="paper-authors">
                      <User size={14} />
                      {truncateText(paper.authors, 50)}
                    </div>
                  )}
                </div>
              </div>

              <h3 className="paper-title">
                {truncateText(paper.title, 100)}
              </h3>

              {paper.summary && (
                <p className="paper-summary">
                  {truncateText(paper.summary, 200)}
                </p>
              )}

              <div className="paper-actions">
                <button
                  className="analyze-btn"
                  onClick={() => handlePaperClick(paper)}
                  disabled={loading}
                >
                  {t('papers.analyze')}
                </button>
                <a
                  href={paper.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  <ExternalLink size={16} />
                  {t('papers.viewOriginal')}
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-results">
          <FileText size={48} className="no-results-icon" />
          <h3>{t('papers.noResults')}</h3>
          <p>{t('papers.tryAgain')}</p>
        </div>
      )}
    </div>
  );
};

export default ResearchPapers;

// import React, { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { ExternalLink, FileText, Calendar, User, Loader2, ArrowLeft } from "lucide-react";
// import "./ResearchPapers.css";

// const ResearchPapers = () => {
//   const [results, setResults] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const navigate = useNavigate();

//   // Keyboard shortcut: Alt + ArrowLeft to go back
//   useEffect(() => {
//     const onKey = (e) => {
//       if (e.altKey && e.key === "ArrowLeft") {
//         e.preventDefault();
//         navigate(-1);
//       }
//     };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [navigate]);

//   useEffect(() => {
//     const storedResults = localStorage.getItem("searchResult");
//     if (storedResults) {
//       setResults(JSON.parse(storedResults));
//     } else {
//       navigate("/");
//     }
//   }, [navigate]);

//   const handlePaperClick = async (paper) => {
//     setLoading(true);
//     setError("");

//     try {
//       // Step 1: Log the click
//       await fetch("https://vani-backend-311709302102.europe-west1.run.app/log-click", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify(paper),
//       });

//       // Step 2: Update PDF and reload model
//       const updateResponse = await fetch("https://vani-backend-311709302102.europe-west1.run.app/update-pdf", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ link: paper.url }),
//       });

//       if (!updateResponse.ok) {
//         throw new Error("Failed to update PDF");
//       }

//       // Step 3: Navigate to PDF viewer
//       navigate("/pdf-viewer");
//     } catch (error) {
//       console.error("Error during click or PDF update:", error);
//       setError("Failed to load paper. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const formatDate = (dateString) => {
//     if (!dateString) return "Unknown";
//     try {
//       return new Date(dateString).toLocaleDateString();
//     } catch {
//       return dateString;
//     }
//   };

//   const truncateText = (text, maxLength) => {
//     if (!text) return "";
//     return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
//   };

//   return (
//     <div className="research-container">
//       <div className="research-header">
//         {/* Back button placed in the left white space beside the centered title */}
//         <div className="back-button-wrap">
//           <button
//             type="button"
//             className="back-btn"
//             aria-label="Go back"
//             onClick={() => navigate(-1)}
//           >
//             <ArrowLeft size={18} />
//             <span>Back</span>
//           </button>
//         </div>

//         <h1>Research Papers</h1>
//         <p>Found {results.length} papers matching your search</p>
//       </div>

//       {loading && (
//         <div className="loading-overlay">
//           <Loader2 className="loading-spinner" size={32} />
//           <p>Loading paper...</p>
//         </div>
//       )}

//       {error && <div className="error-message">{error}</div>}

//       {results.length > 0 ? (
//         <div className="papers-grid">
//           {results.map((paper, index) => (
//             <div key={index} className="paper-card">
//               <div className="paper-header">
//                 <FileText className="paper-icon" size={20} />
//                 <div className="paper-meta">
//                   {paper.published && (
//                     <div className="paper-date">
//                       <Calendar size={14} />
//                       {formatDate(paper.published)}
//                     </div>
//                   )}
//                   {paper.authors && (
//                     <div className="paper-authors">
//                       <User size={14} />
//                       {truncateText(paper.authors, 50)}
//                     </div>
//                   )}
//                 </div>
//               </div>

//               <h3 className="paper-title">{truncateText(paper.title, 100)}</h3>

//               {paper.summary && (
//                 <p className="paper-summary">{truncateText(paper.summary, 200)}</p>
//               )}

//               <div className="paper-actions">
//                 <button
//                   className="analyze-btn"
//                   onClick={() => handlePaperClick(paper)}
//                   disabled={loading}
//                 >
//                   Analyze with AI
//                 </button>
//                 <a
//                   href={paper.url}
//                   target="_blank"
//                   rel="noopener noreferrer"
//                   className="external-link"
//                 >
//                   <ExternalLink size={16} />
//                   View Original
//                 </a>
//               </div>
//             </div>
//           ))}
//         </div>
//       ) : (
//         <div className="no-results">
//           <FileText size={48} className="no-results-icon" />
//           <h3>No papers found</h3>
//           <p>Try searching with different keywords</p>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ResearchPapers;
