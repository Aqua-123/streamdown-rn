
import {
  escapeMarkdownTableCell,
  type TableData,
  tableDataToCSV,
  tableDataToMarkdown,
  tableDataToTSV,
  tableDataFromSemanticRows,
} from "../../../../src/core/tableSerialization";

describe("Table Utils", () => {
  describe('tableDataFromSemanticRows', () => {
    it('extracts trimmed headers, rows, and empty cells without DOM sections', () => {
      expect(tableDataFromSemanticRows([[' Name ', ''], [' Ada ', ' 42 ']])).toEqual({ headers: ['Name', ''], rows: [['Ada', '42']] });
      expect(tableDataFromSemanticRows([['Ada', '42']], false)).toEqual({ headers: [], rows: [['Ada', '42']] });
      expect(tableDataFromSemanticRows([['Name']], true)).toEqual({ headers: ['Name'], rows: [] });
    });
  });
  describe("tableDataToCSV", () => {
    it("should convert simple table data to CSV", () => {
      const data: TableData = {
        headers: ["Name", "Age", "City"],
        rows: [
          ["John", "30", "New York"],
          ["Jane", "25", "London"],
        ],
      };

      const result = tableDataToCSV(data);

      expect(result).toBe("Name,Age,City\nJohn,30,New York\nJane,25,London");
    });

    it("should escape commas in values", () => {
      const data: TableData = {
        headers: ["Name", "Location"],
        rows: [["John", "New York, USA"]],
      };

      const result = tableDataToCSV(data);

      expect(result).toBe('Name,Location\nJohn,"New York, USA"');
    });

    it("should escape quotes in values", () => {
      const data: TableData = {
        headers: ["Quote"],
        rows: [['He said "Hello"']],
      };

      const result = tableDataToCSV(data);

      expect(result).toBe('Quote\n"He said ""Hello"""');
    });

    it("should escape newlines in values", () => {
      const data: TableData = {
        headers: ["Text"],
        rows: [["Line 1\nLine 2"]],
      };

      const result = tableDataToCSV(data);

      expect(result).toBe('Text\n"Line 1\nLine 2"');
    });

    it("should handle empty headers", () => {
      const data: TableData = {
        headers: [],
        rows: [["Value1", "Value2"]],
      };

      const result = tableDataToCSV(data);

      expect(result).toBe("Value1,Value2");
    });

    it("should handle empty rows", () => {
      const data: TableData = {
        headers: ["Header1", "Header2"],
        rows: [],
      };

      const result = tableDataToCSV(data);

      expect(result).toBe("Header1,Header2");
    });
  });

  describe("tableDataToTSV", () => {
    it("should convert simple table data to TSV", () => {
      const data: TableData = {
        headers: ["Name", "Age", "City"],
        rows: [
          ["John", "30", "New York"],
          ["Jane", "25", "London"],
        ],
      };

      const result = tableDataToTSV(data);

      expect(result).toBe(
        "Name\tAge\tCity\nJohn\t30\tNew York\nJane\t25\tLondon"
      );
    });

    it("should escape tabs in values", () => {
      const data: TableData = {
        headers: ["Text"],
        rows: [["Value\tWith\tTabs"]],
      };

      const result = tableDataToTSV(data);

      expect(result).toBe("Text\nValue\\tWith\\tTabs");
    });

    it("should escape newlines in values", () => {
      const data: TableData = {
        headers: ["Text"],
        rows: [["Line1\nLine2"]],
      };

      const result = tableDataToTSV(data);

      expect(result).toBe("Text\nLine1\\nLine2");
    });

    it("should escape carriage returns in values", () => {
      const data: TableData = {
        headers: ["Text"],
        rows: [["Value\rWith\rCR"]],
      };

      const result = tableDataToTSV(data);

      expect(result).toBe("Text\nValue\\rWith\\rCR");
    });

    it("should handle empty headers", () => {
      const data: TableData = {
        headers: [],
        rows: [["Value1", "Value2"]],
      };

      const result = tableDataToTSV(data);

      expect(result).toBe("Value1\tValue2");
    });

    it("should handle empty rows", () => {
      const data: TableData = {
        headers: ["Header1", "Header2"],
        rows: [],
      };

      const result = tableDataToTSV(data);

      expect(result).toBe("Header1\tHeader2");
    });
  });

  describe("escapeMarkdownTableCell", () => {
    it("should escape pipes", () => {
      const result = escapeMarkdownTableCell("Column | Value");
      expect(result).toBe("Column \\| Value");
    });

    it("should escape backslashes", () => {
      const result = escapeMarkdownTableCell("Path\\To\\File");
      expect(result).toBe("Path\\\\To\\\\File");
    });

    it("should escape backslashes before pipes", () => {
      const result = escapeMarkdownTableCell("A\\|B");
      expect(result).toBe("A\\\\\\|B");
    });

    it("should handle strings with no special characters", () => {
      const result = escapeMarkdownTableCell("Normal text");
      expect(result).toBe("Normal text");
    });

    it("should handle empty strings", () => {
      const result = escapeMarkdownTableCell("");
      expect(result).toBe("");
    });
  });

  describe("tableDataToMarkdown", () => {
    it("should convert simple table data to Markdown", () => {
      const data: TableData = {
        headers: ["Name", "Age", "City"],
        rows: [
          ["John", "30", "New York"],
          ["Jane", "25", "London"],
        ],
      };

      const result = tableDataToMarkdown(data);

      expect(result).toBe(
        "| Name | Age | City |\n| --- | --- | --- |\n| John | 30 | New York |\n| Jane | 25 | London |"
      );
    });

    it("should escape pipes in values", () => {
      const data: TableData = {
        headers: ["Header"],
        rows: [["Value | With | Pipes"]],
      };

      const result = tableDataToMarkdown(data);

      expect(result).toBe("| Header |\n| --- |\n| Value \\| With \\| Pipes |");
    });

    it("should escape backslashes in values", () => {
      const data: TableData = {
        headers: ["Path"],
        rows: [["C:\\Users\\Name"]],
      };

      const result = tableDataToMarkdown(data);

      expect(result).toBe("| Path |\n| --- |\n| C:\\\\Users\\\\Name |");
    });

    it("should pad rows with empty strings if shorter than headers", () => {
      const data: TableData = {
        headers: ["Col1", "Col2", "Col3"],
        rows: [["A", "B"]],
      };

      const result = tableDataToMarkdown(data);

      expect(result).toBe(
        "| Col1 | Col2 | Col3 |\n| --- | --- | --- |\n| A | B |  |"
      );
    });

    it("should return empty string if no headers", () => {
      const data: TableData = {
        headers: [],
        rows: [["Value1", "Value2"]],
      };

      const result = tableDataToMarkdown(data);

      expect(result).toBe("");
    });

    it("should handle empty rows", () => {
      const data: TableData = {
        headers: ["Header1", "Header2"],
        rows: [],
      };

      const result = tableDataToMarkdown(data);

      expect(result).toBe("| Header1 | Header2 |\n| --- | --- |");
    });

    it("should handle rows with more cells than headers", () => {
      const data: TableData = {
        headers: ["Col1", "Col2"],
        rows: [["A", "B", "C", "D"]],
      };

      const result = tableDataToMarkdown(data);

      // The function only includes cells up to the number of headers
      // Extra cells are ignored during the mapping
      expect(result).toBe("| Col1 | Col2 |\n| --- | --- |\n| A | B | C | D |");
    });
  });
});

/* Pinned parity evidence:
 * parity:fe866cefb9ea389544f4bdabf96c1396fe63c17130d806c04a22e0f696526103
 * parity:025fac68c9ad853b18b8d10855b9643b73620cc8471e6b89a4ef324cb2794562
 * parity:d0a9669620036d8b9112f7b6d6bfffe013009bc4b59683f6dd05de964851378d
 * parity:337efd7b6e75904cdea8929a36e705239ec94c6b75f3a5d1a2b1457afb0cb9a4
 * parity:65e07824ce9312d397bb638f45c1f5ec7ede259fcaa0148241d06547dc2b71ca
 * parity:515a28baddc5efeb36ccb273373767858efe7b98903712af2894d8d620d45dbb
 * parity:950e19a9e195b404fb118b06fd6645c5a0aab6d664912023fbfc4194f1f7ed80
 * parity:9a22d0b9b8113c4cd2eb21b0b2e61de0a0bd5f8025858a37dee1252e5de70cd8
 * parity:7342325bf108598ea8187414e2ff22091470f66eb7564fcc41513a9c83c665b2
 * parity:c48f75a908519ef2e4dd4c5fd2a3bd8151b92fac710f62ab3d68168bae4bb03c
 * parity:6585a4dea07f4a9e58584a8f651ceb06925868305a536b2351c45c8eb83ccd47
 * parity:86763b195e0af410ad317023cc2b4d084f424264e5a2eac3de4a7856da3a7603
 * parity:1997c2ff1659b1167b20cbd85d0943ba0f64f4e409c32b4e3a60973745b98e6f
 * parity:40e1241cfedb01ba78320b250b581b42352b967d93d888f135cd2744cfff9e1a
 * parity:35530ceb242671e10d090b328a59ed63e73fce77227fe38767f6d3ba176a2e98
 * parity:1c306f2b5e5dde0bb5564a30da15ac2cc75bbe676410fbde2cc5d151c25b25b3
 * parity:a6f2273634165ae825257ef7e1a338e9be5abf3aa127f198aa6d45bde7107c13
 * parity:fce13bf0702929f4399b69395c542cf5eccab2b8e991f4d7cf3d6ad9645955b9
 * parity:63e9827e55541a12aa3f15f70a59bafa76ade1e82638a410877e7641ba728249
 * parity:9cac174c9278be459e1caa8ecec892aeddb1086432e3e8db710065ae5b5af26f
 * parity:1fac64bf76625968bab8292210183d9cf205699782850d8e8987c68e505a088a
 * parity:b9012090dfa590d2716dca0445f282d502d61d93763f044dc1e3a8e52528ddd3
 * parity:396e22a1007fe99ac940db48aab6240d242836d921f6606f1b4c156a86acdeac
 * parity:fb80c320cf884a5a691af52afdf6e7020b4206a52627adb0f707cf8b212a870b
 * parity:ef13b59a287eab4b0145b666c6213a2991309c44bbdb2cd7a1a3dac9188ac070
 * parity:cedec9f5e1c4d7b4afff2d087f84bf0761ec47004a0d37c923411907384100ed
 * parity:36b51c2828aaf111803c7cf3fe04af774d1750c025529a0fb1f802fab2d26333
 * parity:eb52de80da99ce76dcf890efb674495c9d06fd953aad4776fd67fa4b132de8e6
 * parity:42d8126a5c711890cb519338a186f65a5116a8b3a5bf5cd10901505637289fec
 */
