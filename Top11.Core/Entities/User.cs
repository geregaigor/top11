namespace Top11.Core.Entities
{
	public class User
	{
		public int Id { get; set; }
		public required string Login { get; set; }
		public required string Email { get; set; }
	}
}
