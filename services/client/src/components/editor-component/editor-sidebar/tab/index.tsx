import { Blocks, Component, Database, SquareStackIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "../../../ui-component/Tabs";

type Props = {};

const TabList = (props: Props) => {
  return (
    <TabsList className=" flex items-center flex-col justify-evenly w-full bg-transparent h-fit gap-4 ">
      <TabsTrigger
        value="Components"
        className="w-10 h-10 p-0 data-[state=active]:bg-muted"
      >
        <Component />
      </TabsTrigger>
      <TabsTrigger
        value="blocks"
        className="data-[state=active]:bg-muted w-10 h-10 p-0"
      >
        <Blocks />
      </TabsTrigger>

      <TabsTrigger
        value="Layers"
        className="w-10 h-10 p-0 data-[state=active]:bg-muted"
      >
        <SquareStackIcon />
      </TabsTrigger>
      <TabsTrigger
        value="Media"
        className="w-10 h-10 p-0 data-[state=active]:bg-muted"
      >
        <Database />
      </TabsTrigger>
    </TabsList>
  );
};

export default TabList;
