import React from 'react';

const LogPanel = ({ logs }) => {
  return (
    <div className="log-panel">
      <h3>Activity Log</h3>
      <div className="log-content">
        {logs.length === 0 ? (
          <p className="no-logs">No activity yet</p>
        ) : (
          <ul className="log-list">
            {logs.slice(-10).reverse().map(log => (
              <li key={log.id} className="log-item">
                <span className="log-time">{log.timestamp}</span>
                <span className="log-message">{log.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LogPanel;