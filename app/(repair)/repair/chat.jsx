export default function Chat({ repairInfo }) {
  return (
    <div className="w-2/3 border-r flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {repairInfo && (
          <div className="bg-gray-700 p-3 rounded-lg max-w-xl">
            <h3 className="font-bold mb-2">Repair Started</h3>

            <p>Model: {repairInfo.sn_info?.model}</p>

            {repairInfo.ecn?.description && (
              <p>ECN: {repairInfo.ecn.description}</p>
            )}

            {repairInfo.claims?.length > 0 && (
              <>
                <p className="mt-2 font-bold">Previous Claims</p>

                {repairInfo.claims.map((claim, index) => (
                  <p key={index}>
                    {claim.date} - {claim.fault}
                  </p>
                ))}
              </>
            )}

            {repairInfo?.model_info?.length > 0 && (
              <>
                <p className="mt-2 font-bold">Model Recommendations</p>

                <ul className="list-disc ml-5">
                  {repairInfo.model_info.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <form className="flex gap-2">
          <textarea
            placeholder="Ask about a repair..."
            rows={1}
            className="flex-1 resize-none border rounded-lg px-4 py-3"
          />

          <button
            type="submit"
            className="px-4 py-2 hover:cursor-pointer hover:bg-blue-400 bg-blue-600 text-white rounded-lg"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
