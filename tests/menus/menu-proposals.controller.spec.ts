import { MenuProposalsController } from '../../src/modules/menu-proposals/controllers/menu-proposals.controller';
import { MenuProposalsService } from '../../src/modules/menu-proposals/services/menu-proposals.service';

describe('MenuProposalsController - Excel Export Filename', () => {
  let controller: MenuProposalsController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      proposeMenu: jest.fn(),
      getAdminProposals: jest.fn(),
      getMyProposals: jest.fn(),
      getPublicProposals: jest.fn(),
      getDetail: jest.fn(),
      getProposalDayDetail: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      exportProposalExcel: jest.fn().mockResolvedValue(Buffer.from('excel-binary-content')),
      deleteProposal: jest.fn(),
    };

    controller = new MenuProposalsController(mockService as MenuProposalsService);
  });

  describe('exportProposal', () => {
    it('should set Content-Disposition header with filename menu_proposal_${id}.xlsx matching Java POI', async () => {
      const proposalId = BigInt(42);
      const res: any = {
        setHeader: jest.fn(),
        end: jest.fn(),
      };
      const user = { id: 'user-1' };

      await controller.exportProposal(proposalId, { columns: [] }, user, res);

      expect(mockService.exportProposalExcel).toHaveBeenCalledWith({
        id: proposalId,
        columns: [],
        currentUser: user,
      });

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('filename="menu_proposal_42.xlsx"'),
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Length',
        Buffer.from('excel-binary-content').length,
      );
      expect(res.end).toHaveBeenCalled();
    });
  });
});
