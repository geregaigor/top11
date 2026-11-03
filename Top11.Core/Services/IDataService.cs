using Top11.Core.Entities;

namespace Top11.Core.Services
{
	public interface IDataService
	{
		public record CreateUserModel(string GoogleId);
		Guid CreaetUser(CreateUserModel user);

		Task<User> GetUserByGoogleId(string googleId);
	}
}
