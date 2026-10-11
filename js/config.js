/* Grably config — edit these, no code changes needed.
 *
 * API: the fetch relay. Default is a free community instance.
 * If it gets slow or rate-limits you, run your own cobalt API instance
 * (https://github.com/imputnet/cobalt) and put its URL + key here.
 */
window.GRABLY = {
  apiEndpoint: "https://rue-cobalt.xenon.zone",
  apiKey: "", // optional: Authorization: Api-Key <key>

  /* ADS — paste your ad network's HTML/script snippet as a string.
   * Leave empty ("") to show a quiet placeholder box instead. */
  ads: {
    leaderboard: "",
    incontent: "",
    sticky: ""
  },

  sampleLink: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
};
