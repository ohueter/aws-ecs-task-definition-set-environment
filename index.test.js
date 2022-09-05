const run = require(".");
const core = require("@actions/core");
const tmp = require("tmp");
const fs = require("fs");

jest.mock("@actions/core");
jest.mock("tmp");
jest.mock("fs");

describe("Render task definition", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    core.getInput = jest
      .fn()
      .mockReturnValueOnce("task-definition.json") // task-definition
      .mockReturnValueOnce("web") // container-name
      .mockReturnValueOnce("ENV_VAR") // env-var-name
      .mockReturnValueOnce("ENV_VALUE"); // env-var-value

    process.env = Object.assign(process.env, { GITHUB_WORKSPACE: __dirname });
    process.env = Object.assign(process.env, {
      RUNNER_TEMP: "/home/runner/work/_temp",
    });

    tmp.fileSync.mockReturnValue({
      name: "new-task-def-file-name",
    });

    fs.existsSync.mockReturnValue(true);

    jest.mock(
      "./task-definition.json",
      () => ({
        family: "task-def-family",
        containerDefinitions: [
          {
            name: "web",
            image: "some-other-image",
            environment: [
              {
                name: "ENV_VAR",
                value: "",
              },
              {
                name: "OTHER_ENV_VAR",
                value: "OTHER_VALUE",
              },
            ],
          },
          {
            name: "sidecar",
            image: "hello",
          },
        ],
      }),
      { virtual: true }
    );
  });

  test("renders the task definition and creates a new task def file", async () => {
    await run();
    expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
      tmpdir: "/home/runner/work/_temp",
      prefix: "task-definition-",
      postfix: ".json",
      keep: true,
      discardDescriptor: true,
    });
    expect(fs.writeFileSync).toHaveBeenNthCalledWith(
      1,
      "new-task-def-file-name",
      JSON.stringify(
        {
          family: "task-def-family",
          containerDefinitions: [
            {
              name: "web",
              image: "some-other-image",
              environment: [
                {
                  name: "ENV_VAR",
                  value: "ENV_VALUE",
                },
                {
                  name: "OTHER_ENV_VAR",
                  value: "OTHER_VALUE",
                },
              ],
            },
            {
              name: "sidecar",
              image: "hello",
            },
          ],
        },
        null,
        2
      )
    );
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      "task-definition",
      "new-task-def-file-name"
    );
  });

  test("renders a task definition at an absolute path", async () => {
    core.getInput = jest
      .fn()
      .mockReturnValueOnce("/hello/task-definition.json") // task-definition
      .mockReturnValueOnce("web") // container-name
      .mockReturnValueOnce("ENV_VAR") // env-var-name
      .mockReturnValueOnce("ENV_VALUE"); // env-var-value
    jest.mock(
      "/hello/task-definition.json",
      () => ({
        family: "task-def-family",
        containerDefinitions: [
          {
            name: "web",
            image: "some-other-image",
            environment: [
              {
                name: "ENV_VAR",
                value: "",
              },
              {
                name: "OTHER_ENV_VAR",
                value: "OTHER_VALUE",
              },
            ],
          },
        ],
      }),
      { virtual: true }
    );

    await run();

    expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
      tmpdir: "/home/runner/work/_temp",
      prefix: "task-definition-",
      postfix: ".json",
      keep: true,
      discardDescriptor: true,
    });
    expect(fs.writeFileSync).toHaveBeenNthCalledWith(
      1,
      "new-task-def-file-name",
      JSON.stringify(
        {
          family: "task-def-family",
          containerDefinitions: [
            {
              name: "web",
              image: "some-other-image",
              environment: [
                {
                  name: "ENV_VAR",
                  value: "ENV_VALUE",
                },
                {
                  name: "OTHER_ENV_VAR",
                  value: "OTHER_VALUE",
                },
              ],
            },
          ],
        },
        null,
        2
      )
    );
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      "task-definition",
      "new-task-def-file-name"
    );
  });

  test("renders the task definition with added env vars when no environment was present", async () => {
    jest.mock(
      "./no-environment-task-definition.json",
      () => ({
        family: "task-def-family",
        containerDefinitions: [
          {
            name: "web",
            image: "some-other-image",
          },
        ],
      }),
      { virtual: true }
    );

    core.getInput = jest
      .fn()
      .mockReturnValueOnce("no-environment-task-definition.json")
      .mockReturnValueOnce("web")
      .mockReturnValueOnce("ENV_VAR") // env-var-name
      .mockReturnValueOnce("ENV_VALUE"); // env-var-value

    await run();

    expect(tmp.fileSync).toHaveBeenNthCalledWith(1, {
      tmpdir: "/home/runner/work/_temp",
      prefix: "task-definition-",
      postfix: ".json",
      keep: true,
      discardDescriptor: true,
    });
    expect(fs.writeFileSync).toHaveBeenNthCalledWith(
      1,
      "new-task-def-file-name",
      JSON.stringify(
        {
          family: "task-def-family",
          containerDefinitions: [
            {
              name: "web",
              image: "some-other-image",
              environment: [
                {
                  name: "ENV_VAR",
                  value: "ENV_VALUE",
                },
              ],
            },
          ],
        },
        null,
        2
      )
    );
    expect(core.setOutput).toHaveBeenNthCalledWith(
      1,
      "task-definition",
      "new-task-def-file-name"
    );
  });

  test("error returned for missing task definition file", async () => {
    fs.existsSync.mockReturnValue(false);
    core.getInput = jest
      .fn()
      .mockReturnValueOnce("does-not-exist-task-definition.json")
      .mockReturnValueOnce("web")
      .mockReturnValueOnce("ENV_VAR") // env-var-name
      .mockReturnValueOnce("ENV_VALUE"); // env-var-value

    await run();

    expect(core.setFailed).toBeCalledWith(
      "Task definition file does not exist: does-not-exist-task-definition.json"
    );
  });

  test("error returned for non-JSON task definition contents", async () => {
    jest.mock("./non-json-task-definition.json", () => "hello", {
      virtual: true,
    });

    core.getInput = jest
      .fn()
      .mockReturnValueOnce("non-json-task-definition.json")
      .mockReturnValueOnce("web")
      .mockReturnValueOnce("ENV_VAR") // env-var-name
      .mockReturnValueOnce("ENV_VALUE"); // env-var-value

    await run();

    expect(core.setFailed).toBeCalledWith(
      "Invalid task definition format: containerDefinitions section is not present or is not an array"
    );
  });

  test("error returned for malformed task definition with non-array container definition section", async () => {
    jest.mock(
      "./malformed-task-definition.json",
      () => ({
        family: "task-def-family",
        containerDefinitions: {},
      }),
      { virtual: true }
    );

    core.getInput = jest
      .fn()
      .mockReturnValueOnce("malformed-task-definition.json")
      .mockReturnValueOnce("web")
      .mockReturnValueOnce("ENV_VAR") // env-var-name
      .mockReturnValueOnce("ENV_VALUE"); // env-var-value

    await run();

    expect(core.setFailed).toBeCalledWith(
      "Invalid task definition format: containerDefinitions section is not present or is not an array"
    );
  });

  test("error returned for malformed task definition with non-array environment definition section", async () => {
    jest.mock(
      "./malformed-environment-task-definition.json",
      () => ({
        family: "task-def-family",
        containerDefinitions: [
          {
            name: "web",
            image: "some-other-image",
            environment: {},
          },
        ],
      }),
      { virtual: true }
    );

    core.getInput = jest
      .fn()
      .mockReturnValueOnce("malformed-environment-task-definition.json")
      .mockReturnValueOnce("web")
      .mockReturnValueOnce("ENV_VAR") // env-var-name
      .mockReturnValueOnce("ENV_VALUE"); // env-var-value

    await run();

    expect(core.setFailed).toBeCalledWith(
      "Invalid task definition format: environment section is not an array"
    );
  });

  test("error returned for task definition without matching container name", async () => {
    jest.mock(
      "./missing-container-task-definition.json",
      () => ({
        family: "task-def-family",
        containerDefinitions: [
          {
            name: "main",
            image: "some-other-image",
            environment: [
              {
                name: "ENV_VAR",
                value: "",
              },
            ],
          },
        ],
      }),
      { virtual: true }
    );

    core.getInput = jest
      .fn()
      .mockReturnValueOnce("missing-container-task-definition.json")
      .mockReturnValueOnce("web")
      .mockReturnValueOnce("ENV_VAR") // env-var-name
      .mockReturnValueOnce("ENV_VALUE"); // env-var-value

    await run();

    expect(core.setFailed).toBeCalledWith(
      "Invalid task definition: Could not find container definition with matching name"
    );
  });
});
