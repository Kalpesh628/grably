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
    sticky: "",

    /* AGGRESSIVE (snapyt-style): first click anywhere opens this URL in a new
     * tab, then cools down for popunderCooldownMin minutes per visitor.
     * Paste your network's popunder / smartlink URL here.
     * Straight talk: pays fractions of a cent per pop, browsers sometimes
     * block it, and it makes the site feel scammy + hurts Google ranking.
     * Needs big traffic before it earns anything real. */
    popunderUrl: "",
    popunderCooldownMin: 30
  },

  sampleLink: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
};
