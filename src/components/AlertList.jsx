/* One place where an alert's buttons actually do something — navigate to the
   thing that raised it, or apply the fix the recommendation describes. */

import { AlertRow, Empty } from "./ui";
import { useWorld } from "../lib/store";
import { go } from "../lib/router";
import { stallOfAnimal } from "../lib/world";

export default function AlertList({ alerts, now, limit, compact = false, empty = "Nothing needs attention." }) {
  const { world, actions } = useWorld();
  const shown = limit ? alerts.slice(0, limit) : alerts;

  const act = (id, alert) => {
    switch (id) {
      case "openAnimal":
        return go(`animal/${alert.animalId}`);
      case "openStall":
      case "openCamera":
        return go(`video/${alert.stallId}`);
      case "openBarn":
        return go(`barn/${alert.barnId}`);
      case "openLayout":
        return go(`barn/${alert.barnId}?t=layout`);
      case "swapStalls": {
        const animal = world.animals.find((a) => a.id === alert.animalId);
        const other = animal?.seenAs ? stallOfAnimal(world, animal.seenAs) : null;
        if (other) actions.swapStalls(alert.stallId, other.id);
        return;
      }
      default:
        return;
    }
  };

  if (!shown.length) return <Empty icon="check">{empty}</Empty>;

  return (
    <div>
      {shown.map((a) => (
        <AlertRow
          key={a.id + (a.at || "")}
          alert={a}
          now={now}
          compact={compact}
          onAction={act}
          onAck={compact ? null : () => actions.setAlertState(a.id, "ack")}
          onDismiss={compact ? null : () => actions.setAlertState(a.id, "dismissed")}
        />
      ))}
    </div>
  );
}
