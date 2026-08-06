/* ============================================
   US CPI-U Annual Averages (BLS series CUUR0000SA0)
   Base period: 1982-84 = 100
   Coverage: 1913 - 2024
   Source: U.S. Bureau of Labor Statistics
   ============================================ */

(function () {
  'use strict';

  // Annual averages for the CPI-U (All Urban Consumers, U.S. city average,
  // all items, not seasonally adjusted). The BLS publishes a single unified
  // historical series going back to 1913; values are the 12-month arithmetic
  // mean of monthly index values for each calendar year.
  //
  // Citation:
  //   U.S. Bureau of Labor Statistics, "Consumer Price Index for All Urban
  //   Consumers (CPI-U): U.S. city average, all items, not seasonally
  //   adjusted," series CUUR0000SA0, annual averages 1913-2024.
  //   See the BLS Consumer Price Index home page (series CUUR0000SA0).
  //
  // This file is bundled into the tool page (no network fetch) so the
  // calculator works offline and the trust-surface "view source" claim
  // holds — anyone can audit the underlying numbers by reading this file.
  var ANNUAL = [
    { year: 1913, index:   9.9 },
    { year: 1914, index:  10.0 },
    { year: 1915, index:  10.1 },
    { year: 1916, index:  10.9 },
    { year: 1917, index:  12.8 },
    { year: 1918, index:  15.1 },
    { year: 1919, index:  17.3 },
    { year: 1920, index:  20.0 },
    { year: 1921, index:  17.9 },
    { year: 1922, index:  16.8 },
    { year: 1923, index:  17.1 },
    { year: 1924, index:  17.1 },
    { year: 1925, index:  17.5 },
    { year: 1926, index:  17.7 },
    { year: 1927, index:  17.4 },
    { year: 1928, index:  17.1 },
    { year: 1929, index:  17.1 },
    { year: 1930, index:  16.7 },
    { year: 1931, index:  15.2 },
    { year: 1932, index:  13.7 },
    { year: 1933, index:  13.0 },
    { year: 1934, index:  13.4 },
    { year: 1935, index:  13.7 },
    { year: 1936, index:  13.9 },
    { year: 1937, index:  14.4 },
    { year: 1938, index:  14.1 },
    { year: 1939, index:  13.9 },
    { year: 1940, index:  14.0 },
    { year: 1941, index:  14.7 },
    { year: 1942, index:  16.3 },
    { year: 1943, index:  17.3 },
    { year: 1944, index:  17.6 },
    { year: 1945, index:  18.0 },
    { year: 1946, index:  19.5 },
    { year: 1947, index:  22.3 },
    { year: 1948, index:  24.1 },
    { year: 1949, index:  23.8 },
    { year: 1950, index:  24.1 },
    { year: 1951, index:  26.0 },
    { year: 1952, index:  26.5 },
    { year: 1953, index:  26.7 },
    { year: 1954, index:  26.9 },
    { year: 1955, index:  26.8 },
    { year: 1956, index:  27.2 },
    { year: 1957, index:  28.1 },
    { year: 1958, index:  28.9 },
    { year: 1959, index:  29.1 },
    { year: 1960, index:  29.6 },
    { year: 1961, index:  29.9 },
    { year: 1962, index:  30.2 },
    { year: 1963, index:  30.6 },
    { year: 1964, index:  31.0 },
    { year: 1965, index:  31.5 },
    { year: 1966, index:  32.4 },
    { year: 1967, index:  33.4 },
    { year: 1968, index:  34.8 },
    { year: 1969, index:  36.7 },
    { year: 1970, index:  38.8 },
    { year: 1971, index:  40.5 },
    { year: 1972, index:  41.8 },
    { year: 1973, index:  44.4 },
    { year: 1974, index:  49.3 },
    { year: 1975, index:  53.8 },
    { year: 1976, index:  56.9 },
    { year: 1977, index:  60.6 },
    { year: 1978, index:  65.2 },
    { year: 1979, index:  72.6 },
    { year: 1980, index:  82.4 },
    { year: 1981, index:  90.9 },
    { year: 1982, index:  96.5 },
    { year: 1983, index: 101.3 },
    { year: 1984, index: 103.9 },
    { year: 1985, index: 107.6 },
    { year: 1986, index: 109.6 },
    { year: 1987, index: 113.6 },
    { year: 1988, index: 118.3 },
    { year: 1989, index: 124.0 },
    { year: 1990, index: 130.7 },
    { year: 1991, index: 136.2 },
    { year: 1992, index: 140.3 },
    { year: 1993, index: 144.5 },
    { year: 1994, index: 148.2 },
    { year: 1995, index: 152.4 },
    { year: 1996, index: 156.9 },
    { year: 1997, index: 160.5 },
    { year: 1998, index: 163.0 },
    { year: 1999, index: 166.6 },
    { year: 2000, index: 172.2 },
    { year: 2001, index: 177.1 },
    { year: 2002, index: 179.9 },
    { year: 2003, index: 184.0 },
    { year: 2004, index: 188.9 },
    { year: 2005, index: 195.3 },
    { year: 2006, index: 201.6 },
    { year: 2007, index: 207.342 },
    { year: 2008, index: 215.303 },
    { year: 2009, index: 214.537 },
    { year: 2010, index: 218.056 },
    { year: 2011, index: 224.939 },
    { year: 2012, index: 229.594 },
    { year: 2013, index: 232.957 },
    { year: 2014, index: 236.736 },
    { year: 2015, index: 237.017 },
    { year: 2016, index: 240.007 },
    { year: 2017, index: 245.120 },
    { year: 2018, index: 251.107 },
    { year: 2019, index: 255.657 },
    { year: 2020, index: 258.811 },
    { year: 2021, index: 270.970 },
    { year: 2022, index: 292.655 },
    { year: 2023, index: 304.702 },
    { year: 2024, index: 314.175 }
  ];

  // Default forward-projection rate. The Fed's long-run inflation target
  // is 2%; we use 3% as a small buffer for current elevated periods. The
  // user can override this in the UI per-input (range 0%-10%).
  var FORWARD_DEFAULT = 3.0;

  // The base period index (1982-84 = 100). Reference value, not used in
  // calculations directly; exposed for completeness and unit tests.
  var BASE = 100.0;

  // Public API (consumed by inflation-calculator.js).
  window.CPI_US_ANNUAL = ANNUAL;
  window.CPI_FORWARD_DEFAULT = FORWARD_DEFAULT;
  window.CPI_BASE = BASE;
})();
