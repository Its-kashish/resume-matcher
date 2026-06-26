import React, { useState } from 'react';

function App() {
  const [resumeMode, setResumeMode] = useState('file'); // 'file' or 'text'
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [role, setRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('beginner');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setResumeFile(file);
      setError(null);
    } else {
      setResumeFile(null);
      setError('Please select a valid PDF file.');
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    
    if (resumeMode === 'file') {
      if (!resumeFile) {
        setError('Please upload a PDF resume.');
        setLoading(false);
        return;
      }
      formData.append('resume_file', resumeFile);
    } else {
      if (!resumeText.trim()) {
        setError('Please paste your resume text.');
        setLoading(false);
        return;
      }
      formData.append('resume_text', resumeText);
    }

    if (!jobDescription.trim()) {
      setError('Please paste the job description.');
      setLoading(false);
      return;
    }

    formData.append('job_description', jobDescription);
    formData.append('role', role);
    formData.append('experience_level', experienceLevel);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/analyze-resume`,  {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'An error occurred during analysis.');
      } else {
        setResult(data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to connect to the backend server. Please verify it is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Resume Compatibility Matcher</h1>
        <p className="subtitle">MVP Resume Evaluator & Gap Analyzer</p>
      </header>

      <main>
        <section className="input-section">
          <form onSubmit={handleAnalyze}>
            <div className="form-group">
              <label>Resume Source</label>
              <div className="mode-toggle">
                <button
                  type="button"
                  className={resumeMode === 'file' ? 'active' : ''}
                  onClick={() => {
                    setResumeMode('file');
                    setError(null);
                  }}
                >
                  Upload PDF
                </button>
                <button
                  type="button"
                  className={resumeMode === 'text' ? 'active' : ''}
                  onClick={() => {
                    setResumeMode('text');
                    setError(null);
                  }}
                >
                  Paste Text
                </button>
              </div>
            </div>

            {resumeMode === 'file' ? (
              <div className="form-group">
                <label htmlFor="resume-file">Upload PDF Resume</label>
                <input
                  id="resume-file"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="file-input"
                />
                {resumeFile && <p className="file-name">Selected: {resumeFile.name}</p>}
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="resume-text">Paste Resume Text</label>
                <textarea
                  id="resume-text"
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your resume contents here..."
                  rows="10"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="role-input">Target Role</label>
              <input
                id="role-input"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Frontend Engineer (default: general software internship)"
              />
            </div>

            <div className="form-group">
              <label htmlFor="experience-level">Experience Level</label>
              <select
                id="experience-level"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
              >
                <option value="beginner">Beginner (default)</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="job-desc">Job Description</label>
              <textarea
                id="job-desc"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here..."
                rows="10"
              />
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Analyzing...' : 'Analyze Resume'}
            </button>
          </form>

          {error && (
            <div className="error-box">
              <strong>Error:</strong> {error}
            </div>
          )}
        </section>

        <section className="results-section">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Evaluating resume against the job description... Please wait.</p>
            </div>
          )}

          {!loading && !result && !error && (
            <div className="placeholder-state">
              <p>Provide inputs and click "Analyze Resume" to view the matching analysis.</p>
            </div>
          )}

          {!loading && result && (
            <div className="results-card">
              <div className="score-header">
                <h2>Match Score</h2>
                <div className="score-badge">{result.match_score}%</div>
              </div>

              {result.reason && (
                <div className="reason-block">
                  <strong>Evaluation Details:</strong>
                  <p>{result.reason}</p>
                </div>
              )}

              {result.score_breakdown && (
                <div className="breakdown-block">
                  <h3>Score Breakdown</h3>
                  <div className="breakdown-grid">
                    <div className="breakdown-item">
                      <span className="breakdown-label">Skills Match:</span>
                      <span className="breakdown-value">{result.score_breakdown.skills_match}%</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-label">Project Relevance:</span>
                      <span className="breakdown-value">{result.score_breakdown.projects_relevance}%</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-label">Experience Relevance:</span>
                      <span className="breakdown-value">{result.score_breakdown.experience_relevance}%</span>
                    </div>
                    <div className="breakdown-item">
                      <span className="breakdown-label">Overall Alignment:</span>
                      <span className="breakdown-value">{result.score_breakdown.overall_alignment}%</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="result-grids">
                <div className="result-block missing-skills">
                  <h3>Missing Skills</h3>
                  {result.missing_skills && result.missing_skills.length > 0 ? (
                    <ul>
                      {result.missing_skills.map((skill, idx) => (
                        <li key={idx}>{skill}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-message">None identified</p>
                  )}
                </div>

                <div className="result-block strengths">
                  <h3>Strengths</h3>
                  {result.strengths && result.strengths.length > 0 ? (
                    <ul>
                      {result.strengths.map((str, idx) => (
                        <li key={idx}>{str}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-message">None identified</p>
                  )}
                </div>

                <div className="result-block weaknesses">
                  <h3>Weaknesses</h3>
                  {result.weaknesses && result.weaknesses.length > 0 ? (
                    <ul>
                      {result.weaknesses.map((weak, idx) => (
                        <li key={idx}>{weak}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-message">None identified</p>
                  )}
                </div>

                <div className="result-block suggestions">
                  <h3>Suggestions</h3>
                  {result.suggestions && result.suggestions.length > 0 ? (
                    <ul>
                      {result.suggestions.map((sug, idx) => (
                        <li key={idx}>{sug}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-message">None identified</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
