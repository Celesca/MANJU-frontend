import { useState } from 'react';
import Navbar from '../components/Navbar';

export default function CallCenter() {
  const [activeCall, setActiveCall] = useState(false);

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      
      <div className="max-w-6xl mx-auto p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Call Center</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Call Status Card */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Call Status</h2>
            <div className="flex items-center space-x-4">
              <div className={`w-4 h-4 rounded-full ${activeCall ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-gray-700">
                {activeCall ? 'Active Call' : 'No Active Call'}
              </span>
            </div>
            <button
              onClick={() => setActiveCall(!activeCall)}
              className={`mt-4 px-6 py-2 rounded-lg font-semibold transition-colors ${
                activeCall
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {activeCall ? 'End Call' : 'Start Call'}
            </button>
          </div>

          {/* Call Controls Card */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Call Controls</h2>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map((key) => (
                <button
                  key={key}
                  className="p-4 bg-gray-100 rounded-lg text-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Recent Calls Card */}
          <div className="bg-white rounded-xl shadow-lg p-6 md:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Recent Calls</h2>
            <div className="space-y-3">
              {[
                { name: 'Customer Support', time: '2 hours ago', duration: '15:32' },
                { name: 'Sales Team', time: '5 hours ago', duration: '08:45' },
                { name: 'Technical Support', time: 'Yesterday', duration: '23:18' },
              ].map((call, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{call.name}</p>
                    <p className="text-sm text-gray-500">{call.time}</p>
                  </div>
                  <span className="text-gray-600">{call.duration}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
