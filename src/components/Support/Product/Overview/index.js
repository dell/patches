import React from "react";
import "./style.css";

export default () => {
  return (
    <div className="product-overview">
      <div
        className="alert alert-primary align-items-center"
        role="alert"
        id="noDriversDiv"
        bis_skin_checked="1"
      >
        <span className="info-icon">
          <svg className="dti drivers-info">
            <svg
              viewBox="0 0 28 28"
              id="dt-filled-alert-info-cir"
              width="100%"
              height="100%"
            >
              <path
                d="M13.9993 0.666016C6.63935 0.666016 0.666016 6.63935 0.666016 13.9993C0.666016 21.3593 6.63935 27.3327 13.9993 27.3327C21.3593 27.3327 27.3327 21.3593 27.3327 13.9993C27.3327 6.63935 21.3593 0.666016 13.9993 0.666016ZM15.3327 20.666H12.666V12.666H15.3327V20.666ZM15.3327 9.99935H12.666V7.33268H15.3327V9.99935Z"
                fill="#006BBD"
              ></path>
            </svg>
          </svg>
        </span>
        <span>
          <b>No product details found.</b> There are no details listed for this
          product.
        </span>
      </div>
    </div>
  );
};
