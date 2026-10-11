/* Grably config — edit these, no code changes needed.
 *
 * API: the fetch relay. Default is a free community instance.
 * If it gets slow or rate-limits you, run your own cobalt API instance
 * (https://github.com/imputnet/cobalt) and put its URL + key here.
 */
window.GRABLY = {
  apiEndpoint: "https://cobalt-relay-production.up.railway.app",
  apiKey: "d5b54b26-b43b-43e5-9dec-8ef5361732d0", // private relay key (rate-limited)

  /* ADS — banner units render inside isolated iframes (their <script> codes
   * run unmodified, no global collisions). Paste new codes as the `html`
   * string; note the <\/script> escaping inside JS strings.
   * popunderScript = Adsterra popunder <script> (appended to <body>, fires itself).
   * popunderUrl = smartlink URL opened on first click (cooldown below). */
  ads: {
    units: [
      { slot: "adLeaderboard", width: 728, height: 90,
        html: "<script>atOptions={'key':'4105ddc1733c0b2b8fc59a608a394052','format':'iframe','height':90,'width':728,'params':{}};<\/script><script src=\"https://bellnewyork.org/22/4105ddc1733c0b2b8fc59a608a394052\"><\/script>" },
      { slot: "adIncontent", width: 300, height: 250,
        html: "<script>atOptions={'key':'1cf1e90d00fef86e51c438f9c02b7a50','format':'iframe','height':250,'width':300,'params':{}};<\/script><script src=\"https://bellnewyork.org/22/1cf1e90d00fef86e51c438f9c02b7a50\"><\/script>" },
      { slot: "adIncontent2", width: 300, height: 250,
        html: "<script>atOptions={'key':'1cf1e90d00fef86e51c438f9c02b7a50','format':'iframe','height':250,'width':300,'params':{}};<\/script><script src=\"https://bellnewyork.org/22/1cf1e90d00fef86e51c438f9c02b7a50\"><\/script>" },
      { slot: "adSticky", width: 0, height: 0, html: "" }
    ],
    popunderScript: "https://accountut.com/1/9aa580e591dcdd4628e5ed598b86f52f",

    /* AGGRESSIVE (snapyt-style): first click anywhere opens this URL in a new
     * tab, then cools down for popunderCooldownMin minutes per visitor.
     * Paste your network's popunder / smartlink URL here.
     * Straight talk: pays fractions of a cent per pop, browsers sometimes
     * block it, and it makes the site feel scammy + hurts Google ranking.
     * Needs big traffic before it earns anything real. */
    popunderUrl: "https://ardance.org/4/c55a3cae6c517d3a1f32ad2ce0665d2c",
    popunderCooldownMin: 30
  },

  sampleLink: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
};
