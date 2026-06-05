export default function Page() {
  return (
    <div className="h-full flex items-center justify-center bg-gray-100">
      <div className="w-1/3 p-4 text-black bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Registration</h2>

        <form className="space-y-4">
          <div>
            <label className="block mb-1">Serial Number</label>
            <input
              type="text"
              className="w-full border border-black rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block mb-1">Model</label>
            <input
              type="text"
              className="w-full border border-black rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block mb-1">Production Date</label>
            <input
              type="date"
              className="w-full border border-black rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block mb-1">Delivery #</label>
            <input
              type="text"
              className="w-full border border-black rounded px-3 py-2"
            />
          </div>

          <div>
            <label className="block mb-1">Tracking #</label>
            <input
              type="text"
              className="w-full border border-black rounded px-3 py-2"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" />
              <span>Checkpoint: Panel Broken</span>
            </label>

            <label className="flex items-center gap-2">
              <input type="checkbox" />
              <span>Checkpoint: Special Customer</span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full rounded bg-blue-600 text-white py-2"
          >
            Register Repair
          </button>
        </form>
      </div>
    </div>
  );
}
