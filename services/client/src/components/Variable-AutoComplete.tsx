
type Props = {
variables : any,
insertMergeTag : any
}

const VariableAutoComplete = ({variables , insertMergeTag}: Props) => {
  return (
    <div
          className="absolute top-2 right-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-3 w-64 transition-transform transform scale-95 opacity-0 animate-fade-in-up"
        >
          <p className="text-gray-700 dark:text-gray-300 font-semibold mb-2">
            Select Merge Tag:
          </p>
          {variables.map((tag : any) => (
            <div
              key={tag.value}
              className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer rounded-md transition-colors"
              onClick={() => insertMergeTag(tag.value)}
            >
              {tag.name}
            </div>
          ))}
        </div>
  )
}

export default VariableAutoComplete