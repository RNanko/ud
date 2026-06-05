"use client";

import { useState, useRef } from "react";

export default function SnInfo({ setRepairInfo }) {
  const [sn, setSn] = useState("");
  const [snInfo, setSnInfo] = useState(null);

  const inputRef = useRef(null);

  const shouldImplementECN =
    snInfo?.ecn?.check_before_date &&
    snInfo?.sn_info?.prod_date &&
    new Date(snInfo.sn_info.prod_date) < new Date(snInfo.ecn.check_before_date);

  const fetchSn = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(
        `https://nankind-repair.hf.space/sn/${encodeURIComponent(sn)}`,
      );

      if (!response.ok) {
        throw new Error("SN not found");
      }

      const data = await response.json();
      setSnInfo(data);
    } catch (error) {
      console.log(error);
      inputRef.current?.focus();
      inputRef.current?.select();
      setSnInfo({
        error: "No SN found. Register SN or check entered value.",
      });
    }
  };

  return (
    <div className="w-1/3 bg-gray-100 flex flex-col">
      <div className="p-4 text-black bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Start Repair</h2>

        <form onSubmit={fetchSn} className="space-y-4">
          <div>
            <label className="block mb-1">Serial Number</label>

            <input
              ref={inputRef}
              type="text"
              value={sn}
              onChange={(e) => setSn(e.target.value)}
              className="w-full border border-black rounded px-3 py-2"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded hover:cursor-pointer hover:bg-blue-400 bg-blue-600 text-white py-2"
          >
            Check SN
          </button>
        </form>

        {snInfo?.error ? (
          <p className="mt-4 p-3 bg-white border rounded font-bold text-red-600">
            {snInfo.error}
          </p>
        ) : (
          snInfo && (
            <div className="mt-4 space-y-4">
              {/* SN Info */}
              <div className="p-3 bg-white border rounded">
                <h3 className="font-bold mb-2">SN Info</h3>

                <p>
                  <strong>SN:</strong> {sn}
                </p>

                <p>
                  <strong>Model:</strong> {snInfo.sn_info?.model}
                </p>

                <p>
                  <strong>Registration Date:</strong> {snInfo.sn_info?.reg_date}
                </p>

                <p>
                  <strong>Delivery Date:</strong>{" "}
                  {snInfo.sn_info?.delivery_date}
                </p>
              </div>

              {/* ECN */}
              {snInfo?.ecn && Object.keys(snInfo.ecn).length > 0 && (
                <div
                  className={`p-3 bg-white border rounded ${
                    shouldImplementECN ? "text-red-900 border-red-500" : ""
                  }`}
                >
                  <h3 className="font-bold mb-2">ECN</h3>

                  <p>
                    <strong>ECN Number:</strong> {snInfo.ecn.ecn_number}
                  </p>

                  <p>
                    <strong>Description:</strong> {snInfo.ecn.description}
                  </p>

                  <p>
                    <strong>Check Before Date:</strong>{" "}
                    {snInfo.ecn.check_before_date}
                  </p>

                  <p>
                    <strong>Implemented Date:</strong>{" "}
                    {snInfo.ecn.implemented_date}
                  </p>

                  {shouldImplementECN && (
                    <p className="mt-2 font-bold">
                      ECN must be checked for this unit
                    </p>
                  )}
                </div>
              )}

              {/* CLAIMS */}
              <div className="p-3 bg-white border rounded">
                <h3 className="font-bold mb-2">Claims History</h3>

                {snInfo.claims?.length ? (
                  <div className="space-y-2">
                    {snInfo.claims.map((claim, index) => (
                      <div
                        key={index}
                        className="border-b pb-2 last:border-b-0"
                      >
                        <p>
                          <strong>Date:</strong> {claim.date}
                        </p>

                        <p>
                          <strong>Fault:</strong> {claim.fault}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No previous claims found.</p>
                )}
              </div>
            </div>
          )
        )}
      </div>
      {snInfo && (
        <form
          className="mt-auto mb-5"
          onSubmit={(e) => {
            e.preventDefault();
            setRepairInfo(snInfo);
          }}
        >
          <div className="flex flex-row justify-center gap-2">
            <button
              type="submit"
              className="p-5 rounded hover:cursor-pointer hover:bg-blue-400 bg-blue-600 text-white py-2"
            >
              Start Repair With Chat
            </button>

            <button
              type="button"
              className="p-5 rounded hover:cursor-pointer hover:bg-green-400 bg-green-600 text-white py-2"
            >
              Next Work Center
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
