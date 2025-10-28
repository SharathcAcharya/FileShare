import { useState } from 'react';
import './App.css';
import { useTransferManager } from './app/hooks/useTransferManager';
import { FilePicker } from './app/components/FilePicker';
import { QRCodeDisplay } from './app/components/QRCodeDisplay';
import { QRCodeScanner } from './app/components/QRCodeScanner';
import { TransferProgress } from './app/components/TransferProgress';

type View = 'home' | 'send' | 'receive';

function App() {
  const [view, setView] = useState<View>('home');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sessionInput, setSessionInput] = useState({ sessionId: '', token: '' });
  const [useQR, setUseQR] = useState(false);

  const { state, createSession, joinSession, sendFile, receiveFile, reset } = useTransferManager();

  // Handle creating a new session (sender flow)
  const handleStartSending = async () => {
    try {
      const session = await createSession('My Device');
      console.log('[App] Session created:', session);
    } catch (error) {
      console.error('[App] Failed to create session:', error);
    }
  };

  // Handle joining a session (receiver flow)
  const handleJoinSession = async () => {
    if (!sessionInput.sessionId || !sessionInput.token) {
      alert('Please enter session ID and token');
      return;
    }

    try {
      await joinSession(sessionInput.sessionId, sessionInput.token, 'My Device');
      console.log('[App] Joined session');
      // Start receiving automatically
      await receiveFile();
    } catch (error) {
      console.error('[App] Failed to join session:', error);
    }
  };

  // Handle QR code scan
  const handleQRScan = async (data: string) => {
    try {
      // Parse QR data (format: "sessionId:token")
      const [sessionId, token] = data.split(':');
      if (!sessionId || !token) {
        alert('Invalid QR code');
        return;
      }

      await joinSession(sessionId, token, 'My Device');
      console.log('[App] Joined session via QR');
      await receiveFile();
    } catch (error) {
      console.error('[App] Failed to join via QR:', error);
    }
  };

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    
    if (!state.session) {
      // Create session if not already created
      await handleStartSending();
    }
  };

  // Handle sending the file
  const handleSendFile = async () => {
    if (!selectedFile) return;

    try {
      await sendFile(selectedFile);
    } catch (error) {
      console.error('[App] Failed to send file:', error);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    reset();
    setView('home');
    setSelectedFile(null);
    setSessionInput({ sessionId: '', token: '' });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📁 FileShare</h1>
        <p>Secure P2P File Transfer</p>
      </header>

      <main className="app-main">
        {view === 'home' && (
          <div className="home-view">
            <div className="hero">
              <h2>Share files directly, peer-to-peer</h2>
              <p>No uploads, no accounts, no limits. Just you and the recipient.</p>
            </div>

            <div className="action-buttons">
              <button 
                className="btn btn-primary btn-large"
                onClick={() => setView('send')}
              >
                📤 Send Files
              </button>
              <button 
                className="btn btn-secondary btn-large"
                onClick={() => setView('receive')}
              >
                📥 Receive Files
              </button>
            </div>

            <div className="features">
              <div className="feature-card">
                <span className="feature-icon">🔒</span>
                <h3>End-to-End Encrypted</h3>
                <p>Files are encrypted on your device and only the recipient can decrypt them</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">⚡</span>
                <h3>Direct P2P Transfer</h3>
                <p>Files go directly from sender to receiver, no intermediate servers</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">🚀</span>
                <h3>Full Speed</h3>
                <p>Transfer at your network's maximum speed, limited only by your bandwidth</p>
              </div>
            </div>
          </div>
        )}

        {view === 'send' && (
          <div className="send-view">
            <button className="btn btn-text" onClick={handleBack}>
              ← Back
            </button>
            
            <h2>Send Files</h2>

            {state.status === 'idle' && !selectedFile && (
              <>
                <p>Select a file to share</p>
                <FilePicker onFileSelect={handleFileSelect} />
              </>
            )}

            {selectedFile && !state.session && (
              <div className="loading-state">
                <p>Creating session...</p>
              </div>
            )}

            {state.session && !state.session.peerId && (
              <div className="session-info">
                <h3>Share this with the recipient:</h3>
                
                <div className="qr-section">
                  <QRCodeDisplay 
                    data={`${state.session.sessionId}:${state.session.token}`} 
                  />
                  <p className="qr-hint">Scan with your phone camera</p>
                </div>

                <div className="manual-section">
                  <p>Or share these details:</p>
                  <div className="session-details">
                    <div className="detail-row">
                      <label>Session ID:</label>
                      <code>{state.session.sessionId}</code>
                    </div>
                    <div className="detail-row">
                      <label>Token:</label>
                      <code>{state.session.token}</code>
                    </div>
                  </div>
                </div>

                <p className="status-text">⏳ Waiting for recipient to connect...</p>
              </div>
            )}

            {state.session?.peerId && state.status === 'connected' && !state.progress && (
              <div className="ready-to-send">
                <p>✅ Connected to {state.session.peerDisplayName || 'peer'}</p>
                <p>File: <strong>{selectedFile?.name}</strong></p>
                <button className="btn btn-primary btn-large" onClick={handleSendFile}>
                  📤 Send File
                </button>
              </div>
            )}

            {state.status === 'transferring' && state.progress && (
              <TransferProgress {...state.progress} />
            )}

            {state.status === 'completed' && (
              <div className="completion-state">
                <h3>✅ Transfer Complete!</h3>
                <p>Your file was sent successfully</p>
                <button className="btn btn-primary" onClick={handleBack}>
                  Send Another File
                </button>
              </div>
            )}

            {state.status === 'error' && (
              <div className="error-state">
                <h3>❌ Error</h3>
                <p>{state.error || 'Something went wrong'}</p>
                <button className="btn btn-primary" onClick={handleBack}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'receive' && (
          <div className="receive-view">
            <button className="btn btn-text" onClick={handleBack}>
              ← Back
            </button>
            
            <h2>Receive Files</h2>

            {state.status === 'idle' && (
              <>
                <div className="receive-options">
                  <button 
                    className={`btn ${useQR ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setUseQR(true)}
                  >
                    📷 Scan QR Code
                  </button>
                  <button 
                    className={`btn ${!useQR ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setUseQR(false)}
                  >
                    ⌨️ Enter Manually
                  </button>
                </div>

                {useQR ? (
                  <div className="qr-scanner-section">
                    <QRCodeScanner 
                      onScan={handleQRScan}
                      onError={(error) => alert(error)}
                    />
                  </div>
                ) : (
                  <div className="manual-input-section">
                    <div className="input-group">
                      <label htmlFor="sessionId">Session ID:</label>
                      <input
                        id="sessionId"
                        type="text"
                        value={sessionInput.sessionId}
                        onChange={(e) => setSessionInput({ ...sessionInput, sessionId: e.target.value })}
                        placeholder="e.g., abc123def456"
                      />
                    </div>
                    <div className="input-group">
                      <label htmlFor="token">Token:</label>
                      <input
                        id="token"
                        type="text"
                        value={sessionInput.token}
                        onChange={(e) => setSessionInput({ ...sessionInput, token: e.target.value })}
                        placeholder="e.g., xyz789uvw012"
                      />
                    </div>
                    <button 
                      className="btn btn-primary btn-large" 
                      onClick={handleJoinSession}
                      disabled={!sessionInput.sessionId || !sessionInput.token}
                    >
                      🔗 Connect
                    </button>
                  </div>
                )}
              </>
            )}

            {state.status === 'connecting' && (
              <div className="loading-state">
                <p>Connecting to sender...</p>
              </div>
            )}

            {state.status === 'connected' && !state.progress && (
              <div className="connected-state">
                <p>✅ Connected! Waiting for file...</p>
              </div>
            )}

            {state.status === 'transferring' && state.progress && (
              <TransferProgress {...state.progress} />
            )}

            {state.status === 'completed' && (
              <div className="completion-state">
                <h3>✅ Transfer Complete!</h3>
                <p>File downloaded successfully</p>
                <button className="btn btn-primary" onClick={handleBack}>
                  Receive Another File
                </button>
              </div>
            )}

            {state.status === 'error' && (
              <div className="error-state">
                <h3>❌ Error</h3>
                <p>{state.error || 'Something went wrong'}</p>
                <button className="btn btn-primary" onClick={handleBack}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Open source • Privacy-focused • No data collection
        </p>
      </footer>
    </div>
  );
}

export default App;

