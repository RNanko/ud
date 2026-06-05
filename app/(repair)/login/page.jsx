export default function page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96 border-4 border-blue-700">
        <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
          Login
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Login
            </label>
            <input
              type="text"
              defaultValue="Repair Mastex 3000"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-50 text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="text"
              defaultValue="**********"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
            />
          </div>

          <button
            className="w-full bg-blue-600 text-white py-2 
          hover:cursor-pointer
          rounded-md hover:bg-blue-700 transition duration-200 font-semibold"
          >
            <a href="/repair">Sign In</a>
          </button>

          <div className="text-center">
            <a
              href="/repair"
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              Go to Repair Page →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
