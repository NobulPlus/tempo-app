import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Rules",
  description: "How we expect people to behave on Tempo, and what happens when they don't.",
};

export default function CommunityPage() {
  return (
    <>
      <h1>Community Rules</h1>
      <p className="meta">Short, because they should be obvious.</p>

      <p>
        Tempo works because strangers can turn up to a pitch and trust that the game
        will happen and the people will be decent. These rules protect that.
      </p>

      <h2>Turn up</h2>
      <p>
        If you join a game, play it. When you don&apos;t show, nine other people are
        standing on a pitch short of a player. Every no-show costs you{" "}
        <strong>12 points of punctuality</strong>, and that number is public on your
        player card. Two no-shows and hosts start declining you.
      </p>
      <p>
        Things come up — that&apos;s fine. Drop out in the app and the waitlist fills
        your spot automatically. Dropping out early costs you nothing.
      </p>

      <h2>Be on time</h2>
      <p>
        Arriving late costs one punctuality point per five minutes. A 90-minute slot
        with people trickling in for twenty of them is a 70-minute game everyone paid
        full price for.
      </p>

      <h2>Play the level you signed up for</h2>
      <p>
        A casual game means all levels are welcome and nobody is sliding in studs-up.
        A competitive game means people expect intensity. Joining a casual game to
        dominate beginners is a fast route off the platform.
      </p>

      <h2>Nothing that has no place in football</h2>
      <p>
        Racism, tribal abuse, sexism, homophobia, threats and violence get you removed
        permanently, first time, no warning. This applies on the pitch, in game
        descriptions and in messages.
      </p>
      <p>
        Women play on Tempo. Everyone plays on Tempo. Anyone who makes that harder is
        the problem, not them.
      </p>

      <h2>Rate honestly</h2>
      <p>
        Ratings and trait votes exist so good players get picked. Don&apos;t downvote
        someone because you lost. Don&apos;t organise ratings with friends. We can see
        voting patterns and we act on them.
      </p>

      <h2>Pay properly</h2>
      <p>
        Pay through Tempo. Arranging cash on the side leaves you with no refund, no
        guarantee and no record if something goes wrong — and it takes money from
        venues that gave you a rate on the understanding the platform brings volume.
      </p>

      <h2>Hosts have extra responsibility</h2>
      <ul>
        <li>Describe the game accurately, including the level</li>
        <li>Show up early enough to sort teams</li>
        <li>Cancel as early as you know, never on the day if avoidable</li>
        <li>Mark attendance honestly — the whole reputation system depends on it</li>
      </ul>

      <h2>What happens when rules are broken</h2>
      <ol>
        <li>
          <strong>First issue</strong> — reputation adjustment and a note from us
        </li>
        <li>
          <strong>Repeat</strong> — temporary suspension from joining or hosting
        </li>
        <li>
          <strong>Serious or persistent</strong> — permanent removal
        </li>
      </ol>
      <p>
        Abuse, violence and fraud skip straight to permanent removal.
      </p>

      <h2>Report something</h2>
      <p>
        Email <a href="mailto:safety@tempo.ng">safety@tempo.ng</a> with the game and
        what happened. We read every report. If you are in immediate danger, call the
        Lagos State emergency line on <strong>767</strong> or <strong>112</strong>{" "}
        first — then tell us.
      </p>
    </>
  );
}
